//aiRouter.js
import express from 'express';
import fetch from 'cross-fetch';
import OpenAI from 'openai';

export function createAiRouter({ getUserCtx, hooks }) {
  const router = express.Router();

  const provider = process.env.AI_PROVIDER || 'openrouter';
  const model = process.env.AI_MODEL || 'openai/gpt-4o-mini';

  const client = new OpenAI({
    apiKey: provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY,
    baseURL: provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined,
    fetch
  });

  // --- ОПИС "інструментів", які модель може викликати ---
  const tools = [
    {
      type: "function",
      function: {
        name: "search_products",
        description: "Повнотекстовий пошук товарів у базі за назвою/брендом/категорією.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Наприклад: 'чайник Bosch 1.7L'" },
            limit: { type: "number", default: 12 }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "add_to_cart",
        description: "Додати товар у кошик поточного користувача.",
        parameters: {
          type: "object",
          properties: {
            productId: { type: "integer" },
            qty: { type: "integer", default: 1 }
          },
          required: ["productId"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "add_to_compare",
        description: "Додати товар у список порівняння.",
        parameters: {
          type: "object",
          properties: {
            productId: { type: "integer" }
          },
          required: ["productId"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "web_lookup",
        description: "Короткий веб-огляд про товар/бренд (технічні характеристики, огляди). Повертає 1-3 посилання + summary.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" }
          },
          required: ["query"]
        }
      }
    }
  ];

  // --- ІМПЛЕМЕНТАЦІЯ інструментів ---
  async function tool_search_products({ query, limit = 12 }) {
    // 1) Якщо у тебе є пул до MySQL — шукаємо напряму:
    if (hooks?.searchProductsInDB) {
      const items = await hooks.searchProductsInDB(query, limit);
      return { items };
    }
    // 2) Fallback: якщо API вже існує на твоєму бекенді (REST):
    if (hooks?.searchProductsViaAPI) {
      const items = await hooks.searchProductsViaAPI(query, limit);
      return { items };
    }
    // 3) Мінімальний фолбек: порожній список (AI все одно відповість текстом)
    return { items: [] };
  }

  async function tool_add_to_cart({ user, productId, qty = 1 }) {
    // Підключися до своїх існуючих роутів / БД:
    if (hooks?.addToCart) {
      await hooks.addToCart({ user, productId, qty });
      return { ok: true };
    }
    // Fallback: повідомлення клієнту, щоб він виконав дію локально (localStorage/Redux)
    return { ok: true, clientAction: { type: 'cart.add', productId, qty } };
  }

  async function tool_add_to_compare({ user, productId }) {
    if (hooks?.addToCompare) {
      await hooks.addToCompare({ user, productId });
      return { ok: true };
    }
    return { ok: true, clientAction: { type: 'compare.add', productId } };
  }

  async function tool_web_lookup({ query }) {
    // Лайт-варіант без зовнішніх ключів: скористаємося простими публічними сторінками
    // (щоб не тягнути важкі парсери — просто повернемо кілька релевантних лінків).
    const encoded = encodeURIComponent(query);
    const ddg = `https://duckduckgo.com/?q=${encoded}`;
    const ggl = `https://www.google.com/search?q=${encoded}`;
    const wk  = `https://uk.wikipedia.org/wiki/Special:Search?search=${encoded}`;
    return {
      summary: `Ось короткі посилання за запитом «${query}». Перевір, будь ласка:`,
      links: [
        { title: "DuckDuckGo", url: ddg },
        { title: "Google", url: ggl },
        { title: "Wikipedia (uk)", url: wk }
      ]
    };
  }

  // Один цикл обробки: якщо модель викликає tool, виконуємо і віддаємо фінальний результат
  async function runOnce({ messages, user }) {
    const resp = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.5,
      // ВАЖЛИВО: просимо HTML-блоки для карток
      response_format: { type: "text" }
    });

    const choice = resp.choices?.[0];
    const msg = choice?.message;

    if (!msg) return { html: "Вибач, сталася помилка. Спробуй ще раз." };

    // Якщо інструмент
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const tc = msg.tool_calls[0];
      const { name, arguments: argsJSON } = tc.function;
      const args = JSON.parse(argsJSON || "{}");

      let toolResult = null;

      if (name === "search_products") {
        toolResult = await tool_search_products(args);
      } else if (name === "add_to_cart") {
        toolResult = await tool_add_to_cart({ user, ...args });
      } else if (name === "add_to_compare") {
        toolResult = await tool_add_to_compare({ user, ...args });
      } else if (name === "web_lookup") {
        toolResult = await tool_web_lookup(args);
      } else {
        toolResult = { error: `Unknown tool: ${name}` };
      }

      const newMessages = [
        ...messages,
        { role: "assistant", tool_calls: msg.tool_calls, content: msg.content || "" },
        { role: "tool", name, content: JSON.stringify(toolResult) }
      ];

      // Другий виклик — щоб модель сформувала фінальний HTML/текст
      const final = await client.chat.completions.create({
        model,
        messages: newMessages,
        temperature: 0.5
      });

      const finMsg = final.choices?.[0]?.message;
      return {
        html: finMsg?.content || "Готово.",
        actions: toolResult?.clientAction ? [toolResult.clientAction] : undefined
      };
    }

    // Без інструментів — просто віддаємо текст/HTML
    return { html: msg.content || "Готово." };
  }

  // Основний роут
  router.post('/chat', async (req, res) => {
    try {
      const { text, history = [] } = req.body || {};
      const user = getUserCtx?.(req) || null;

      const systemPrompt = [
        "Ти AI-консультант e-commerce платформи Qonto.",
        "Якщо користувач просить додати товар у кошик або у порівняння — викликай відповідний tool.",
        "Якщо потрібен пошук товарів — викликай search_products та поверни компактний HTML зі списком карток (назва, бренд, ціна).",
        "Якщо просять більше інформації про товар в інтернеті — викликай web_lookup.",
        "Форматуй відповіді у лаконічні блоки HTML (див. приклад у клієнті).",
      ].join("\n");

      const messages = [
        { role: "system", content: systemPrompt },
        ...history,                 // [{role:'user', content:'...'}, {role:'assistant', content:'...'}]
        { role: "user", content: text || "" }
      ];

      const result = await runOnce({ messages, user });
      res.json({ ok: true, ...result });
    } catch (e) {
      console.error('AI chat error:', e);
      res.status(500).json({ ok: false, error: 'AI failed' });
    }
  });

  return router;
}

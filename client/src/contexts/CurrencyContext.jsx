// client/src/contexts/CurrencyContext.jsx
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

// Разрешённые валюты в интерфейсе
export const SUPPORTED = [
    { code: 'UAH', label: '₴ UAH' },
    { code: 'EUR', label: '€ EUR' },
    { code: 'USD', label: '$ USD' },
    { code: 'CZK', label: 'Kč CZK' },
    { code: 'GBP', label: '£ GBP' },
];

const DEFAULT = 'UAH';

const CurrencyContext = createContext({
    currency: DEFAULT,
    setCurrency: () => { },
    rates: { UAH: 1 }, // коэффициенты: 1 UAH -> X target
    convertFromUAH: (uah) => uah, // конвертация в выбранную валюту
    formatMoney: (amount) => String(amount), // форматтер
    isLoading: false,
    error: '',
    refreshRates: () => { },
});

export function CurrencyProvider({ children }) {
    const [currency, setCurrency] = useState(
        () => localStorage.getItem('currency') || DEFAULT
    );
    const [rates, setRates] = useState({ UAH: 1 });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // сохраняем выбор пользователя
    useEffect(() => {
        localStorage.setItem('currency', currency);
    }, [currency]);

    const fetchRates = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            // exchangerate.host — бесплатный и без ключа
            const url =
                'https://api.exchangerate.host/latest?base=UAH&symbols=UAH,USD,EUR,GBP,CZK';
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (!data || !data.rates) throw new Error('Bad payload');
            setRates({ ...data.rates, UAH: 1 });
        } catch (e) {
            // фолбэк (грубые коэффициенты)
            setRates({ UAH: 1, USD: 0.024, EUR: 0.022, GBP: 0.019, CZK: 0.55 });
            setError(
                'Не удалось получить курсы. Используются кэш/фолбэк значения.'
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRates();
        const id = setInterval(fetchRates, 12 * 60 * 60 * 1000); // раз в 12 часов
        return () => clearInterval(id);
    }, [fetchRates]);

    const convertFromUAH = useCallback(
        (uah) => {
            const v = Number(uah);
            if (!Number.isFinite(v)) return 0;
            const k = rates[currency] ?? 1;
            return Math.round(v * k); // округляем до целого
        },
        [rates, currency]
    );

    const formatMoney = useCallback(
        (amount) => {
            const locale = navigator.language?.startsWith('uk')
                ? 'uk-UA'
                : 'ru-RU';
            try {
                return new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                }).format(amount);
            } catch {
                return `${amount} ${currency}`;
            }
        },
        [currency]
    );

    const value = useMemo(
        () => ({
            currency,
            setCurrency,
            rates,
            convertFromUAH,
            formatMoney,
            isLoading,
            error,
            refreshRates: fetchRates,
        }),
        [currency, rates, convertFromUAH, formatMoney, isLoading, error, fetchRates]
    );

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    return useContext(CurrencyContext);
}

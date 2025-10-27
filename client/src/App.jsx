// client/src/App.jsx
import './i18n';

import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Home from './Pages/Home';
import About from './Pages/About';
import Contacts from './Pages/Contacts';
import Profile from './Pages/Profile';
import AuthForm from './Components/AuthForm';
import Header from './Components/Header';
import Footer from './Components/Footer';
import ProfilePublic from './Pages/ProfilePublic.jsx';
import ChatList from './Pages/ChatList.jsx';
import ChatThread from './Pages/ChatThread.jsx';

import Chat from './Pages/Chat';
import Catalog from './Pages/Catalog';

import AdminApplications from './Pages/AdminApplications.jsx';
import SellerApplication from './Pages/SellerApplication';
import SellerApplyComplete from './Pages/SellerApplyComplete';

import ProductNew from './Pages/ProductNew';
import AdminDeletions from './Pages/AdminDeletions';
import CartPage from './Pages/CartPage';
import CheckoutPage from './Pages/CheckoutPage';
import MyProducts from './Pages/MyProducts';
import ProductEdit from './Pages/ProductEdit';

import Vacancies from './Pages/Vacancies.jsx';
import Terms from './Pages/Terms.jsx';
import ReturnPage from './Pages/Return.jsx';
import GuaranteePage from './Pages/Guarantee.jsx';
// ❗ правильный регистр папки:
import ProductPage from './Pages/ProductPage';

// 🔥 Новое: страница вишлиста
import WishlistPage from './Pages/Wishlist.jsx';

import ShopPage from './Pages/ShopPage.jsx';
import ProfileSettings from './Pages/ProfileSettings';

import './App.css';

// Обёртка, которая держит <html lang> в актуальном состоянии при смене языка
function I18nShell({ children }) {
  const { i18n } = useTranslation();
  useEffect(() => {
    const apply = (lng) => {
      const htmlLang =
        lng?.startsWith('ua') || lng?.startsWith('uk')
          ? 'uk'
          : lng?.startsWith('en')
          ? 'en'
          : 'ru';
      document.documentElement.lang = htmlLang;
      document.documentElement.dir = 'ltr';
    };
    apply(i18n.language);
    i18n.on('languageChanged', apply);
    return () => i18n.off('languageChanged', apply);
  }, [i18n]);
  return children;
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <I18nShell>
        <Router>
          <div className="app-root">
            <div className="top-brow">
              <div className="container brow-inner">
                <Header />
              </div>
            </div>

            <main className="main-content container">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/auth" element={<AuthForm />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/public" element={<ProfilePublic />} />
                <Route path="/profile/public/:id" element={<ProfilePublic />} />
                <Route path="/chats" element={<ChatList />} />
                <Route path="/chats/:id" element={<ChatThread />} />

                {/* Админ/продавец */}
                <Route path="/admin/applications" element={<AdminApplications />} />
                <Route path="/admin/product-deletions" element={<AdminDeletions />} />
                <Route path="/seller/apply" element={<SellerApplication />} />
                <Route path="/products/new" element={<ProductNew />} />
                <Route path="/my/products" element={<MyProducts />} />
                <Route path="/product/:id/edit" element={<ProductEdit />} />
                  <Route path="/seller/complete" element={<SellerApplyComplete />} />
                  
                {/* Страница товара */}
                <Route path="/product/:id" element={<ProductPage />} />

                {/* Корзина / избранное / оформление */}
                <Route path="/cart" element={<CartPage />} />
                <Route path="/favorites" element={<WishlistPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />

                {/* Чат / каталог */}
                <Route path="/chat" element={<Chat />} />
                <Route path="/catalog" element={<Catalog />} />

                {/* Статические страницы */}
                <Route path="/vacancies" element={<Vacancies />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/returns" element={<ReturnPage />} />
                <Route path="/guarantee" element={<GuaranteePage />} />

                <Route path="/shop/:sellerId" element={<ShopPage />} />
                <Route path="/profile/settings" element={<ProfileSettings />} />
              </Routes>
            </main>

            <Footer />
          </div>
        </Router>
      </I18nShell>
    </Suspense>
  );
}

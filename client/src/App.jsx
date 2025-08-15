// client/src/App.jsx
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom';

import Home from './Pages/Home';
import About from './Pages/About';
import Contacts from './Pages/Contacts';
import Profile from './Pages/Profile';
import { AuthForm } from './Components/AuthForm'; // если у тебя default export, то: import AuthForm from './components/AuthForm';
import Header from './Components/Header';
// src/App.jsx
import AdminApplications from './Pages/AdminApplications.jsx';
import SellerApplication from './Pages/SellerApplication';


import './App.css';

export default function App() {
  return (
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
            <Route path="/admin/applications" element={<AdminApplications />} />
            <Route path="/seller/apply" element={<SellerApplication />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

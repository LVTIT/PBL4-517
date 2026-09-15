import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './components/AuthProvider';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ProductsPage } from './pages/ProductsPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

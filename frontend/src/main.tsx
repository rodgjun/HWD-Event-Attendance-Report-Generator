import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import { AppLayout } from './ui/AppLayout';
import { Landing } from './pages/Landing';
import { Events } from './pages/Events';
import { Registrations } from './pages/Registrations';
import { Attendance } from './pages/Attendance';
import { Reports } from './pages/Reports';
import { Login } from './pages/Login';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'events', element: <Events /> },
      { path: 'registrations', element: <Registrations /> },
      { path: 'attendance', element: <Attendance /> },
      { path: 'reports', element: <Reports /> },
      { path: 'login', element: <Login /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);



import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={viVN} theme={{
      token: {
        colorPrimary: '#2E7D32',
        colorSuccess: '#2E7D32',
        borderRadius: 8,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        colorBgLayout: '#F5F7F5',
      },
      components: {
        Table: { headerBg: '#F7F9F7', rowHoverBg: '#F5FAF5' },
        Layout: { bodyBg: '#F5F7F5', headerBg: '#FFFFFF', siderBg: '#183C21' },
        Menu: {
          darkItemBg: '#183C21',
          darkSubMenuItemBg: '#183C21',
          darkItemSelectedBg: '#2E7D32',
          darkItemHoverBg: '#285e30',
        },
      },
    }}>
      <AntdApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
);

import React, { useState } from 'react';
import Login from './Login';
import Chat from './Chat';

const App = () => {
  const [token, setToken] = useState('');

  return (
    <div>
      {!token ? <Login onLogin={setToken} /> : <Chat token={token} />}
    </div>
  );
};

export default App;

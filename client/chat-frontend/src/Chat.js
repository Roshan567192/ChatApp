import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const Chat = ({ token }) => {
  const socketRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [message, setMessage] = useState('');
  const [typing, setTyping] = useState('');

  useEffect(() => {
    const socket = io('http://localhost:5000', { auth: { token } });
    socketRef.current = socket;

    socket.on('userList', setUsers);
    socket.on('receiveMessage', data => {
      setMessages(prev => [...prev, data]);
    });
    socket.on('typing', data => {
      setTyping(`${data.from} is typing...`);
      setTimeout(() => setTyping(''), 2000);
    });
    socket.on('userOffline', username => {
      setUsers(prev => prev.map(u => u.username === username ? { ...u, online: false } : u));
    });

    return () => socket.disconnect();
  }, [token]);

  useEffect(() => {
    if (!selectedUser) return;
    const fetchMessages = async () => {
      const res = await axios.get(`http://localhost:5000/api/messages?user=${selectedUser}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data);
    };
    fetchMessages();
  }, [selectedUser, token]);

  const sendMessage = () => {
    const trimmed = message.trim();
    if (!selectedUser || !trimmed) return;
    socketRef.current.emit('sendMessage', { to: selectedUser, message: trimmed });
    setMessage('');
  };

  const handleTyping = () => {
    if (selectedUser) {
      socketRef.current.emit('typing', { to: selectedUser });
    }
  };

  const isOnline = users.find(u => u.username === selectedUser)?.online;

  return (
    <div>
      <h2>Chat</h2>
      <ul>
        {users.map(u => (
          <li key={u.username} onClick={() => setSelectedUser(u.username)} style={{ cursor: 'pointer' }}>
            {u.username} {u.online ? '(Online)' : '(Offline)'}
          </li>
        ))}
      </ul>

      {selectedUser && <h3>Chatting with {selectedUser}</h3>}
      {typing && <p>{typing}</p>}
      <div>
        {messages.map((m, i) => (
          <div key={i}><strong>{m.from}:</strong> {m.message}</div>
        ))}
      </div>

      <input
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyUp={handleTyping}
        onKeyDown={e => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage} disabled={!isOnline || !message.trim()}>Send</button>
      {!isOnline && selectedUser && <p style={{ color: 'red' }}>{selectedUser} is offline</p>}
    </div>
  );
};

export default Chat;

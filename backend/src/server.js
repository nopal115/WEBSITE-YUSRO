const express = require('express');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend WEBSITE YUSRO berjalan'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

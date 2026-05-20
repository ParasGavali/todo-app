const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = 'todo-app-secret-key-2024';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  settings: {
    theme: { type: String, default: 'neon-green' }
  }
});

const todoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  notes: { type: String, default: '' },
  completed: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  dueDate: { type: String, default: null },
  dueTime: { type: String, default: null },
  reminder: { type: Boolean, default: false },
  reminder10minSent: { type: Boolean, default: false },
  reminderDueSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Todo = mongoose.model('Todo', todoSchema);

const transporter = nodemailer.createTransport({
  host: 'sandbox.smtp.mailtrap.io',
  port: 2525,
  auth: {
    user: 'f1dcfef6a447ea',
    pass: 'f5f726ff63a9dd'
  }
});

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://ParasGavali:8DX5IzcGPYFpmq6C@finalyearprojects.bzgvuwo.mongodb.net/?appName=FinalYearProjects';
  await mongoose.connect(mongoURI);
  console.log('MongoDB Atlas connected');
};

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

async function sendReminderEmail(userEmail, todo) {
  try {
    await transporter.sendMail({
      from: '"Todo Reminder" <noreply@todoapp.com>',
      to: userEmail,
      subject: `⏰ Reminder: ${todo.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #1a1a2e; border-radius: 10px;">
          <h2 style="color: #00ff88;">Todo Reminder</h2>
          <div style="background: #16213e; padding: 20px; border-radius: 8px; margin: 15px 0;">
            <h3 style="color: #fff; margin: 0 0 10px 0;">${todo.title}</h3>
            ${todo.notes ? `<p style="color: #aaa; margin: 0;">${todo.notes}</p>` : ''}
          </div>
          <p style="color: #888; font-size: 14px;">
            Due: ${todo.dueDate} at ${todo.dueTime}<br>
            Priority: ${todo.priority}
          </p>
          <a href="http://localhost:3000/dashboard.html" style="display: inline-block; background: #00ff88; color: #1a1a2e; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Open Todo App</a>
        </div>
      `
    });
    console.log(`Reminder email sent to ${userEmail} for: ${todo.title}`);
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
}

async function checkReminders() {
  try {
    const pendingTodos = await Todo.find({
      reminder: true,
      completed: false,
      dueDate: { $ne: null },
      dueTime: { $ne: null }
    }).populate('userId');

    const now = new Date();

    for (const todo of pendingTodos) {
      if (!todo.userId) continue;
      const userEmail = todo.userId.email;

      const dueDateTime = new Date(`${todo.dueDate}T${todo.dueTime}`);
      const minutesUntilDue = (dueDateTime.getTime() - now.getTime()) / (1000 * 60);

      if (!todo.reminder10minSent && minutesUntilDue <= 10 && minutesUntilDue > 0) {
        const sent = await sendReminderEmail(userEmail, todo);
        if (sent) {
          todo.reminder10minSent = true;
          await todo.save();
        }
      }

      if (!todo.reminderDueSent && minutesUntilDue <= 0) {
        const sent = await sendReminderEmail(userEmail, todo);
        if (sent) {
          todo.reminderDueSent = true;
          await todo.save();
        }
      }
    }
  } catch (err) {
    console.error('Reminder check error:', err.message);
  }
}

setInterval(checkReminders, 60000);

app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ token, email: user.email });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ token, email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

app.get('/api/todos', authenticate, async (req, res) => {
  const todos = await Todo.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(todos);
});

app.post('/api/todos', authenticate, async (req, res) => {
  const todo = await Todo.create({
    userId: req.userId,
    title: req.body.title,
    notes: req.body.notes || '',
    priority: req.body.priority || 'medium',
    dueDate: req.body.dueDate || null,
    dueTime: req.body.dueTime || null,
    reminder: req.body.reminder || false,
    reminder10minSent: false,
    reminderDueSent: false
  });
  res.json(todo);
});

app.put('/api/todos/:id', authenticate, async (req, res) => {
  const updateData = {};
  if (req.body.completed !== undefined) updateData.completed = req.body.completed;
  if (req.body.title !== undefined) updateData.title = req.body.title;
  if (req.body.notes !== undefined) updateData.notes = req.body.notes;
  if (req.body.priority !== undefined) updateData.priority = req.body.priority;
  if (req.body.dueDate !== undefined) updateData.dueDate = req.body.dueDate;
  if (req.body.dueTime !== undefined) updateData.dueTime = req.body.dueTime;
  if (req.body.reminder !== undefined) {
    updateData.reminder = req.body.reminder;
    if (req.body.reminder) {
      updateData.reminder10minSent = false;
      updateData.reminderDueSent = false;
    }
  }
  
  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    updateData,
    { new: true }
  );
  res.json(todo);
});

app.delete('/api/todos/:id', authenticate, async (req, res) => {
  await Todo.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  res.json({ message: 'Deleted' });
});

app.get('/api/settings', authenticate, async (req, res) => {
  const user = await User.findById(req.userId);
  res.json(user.settings || { theme: 'neon-green' });
});

app.put('/api/settings', authenticate, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.userId,
    { settings: req.body },
    { new: true }
  );
  res.json(user.settings);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  setTimeout(checkReminders, 5000);
}).catch(err => console.error(err));
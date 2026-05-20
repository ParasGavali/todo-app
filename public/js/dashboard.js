const API_URL = 'http://localhost:3000/api';
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'index.html';
}

let todos = [];
let currentFilter = 'all';
let currentTheme = 'neon-green';

if (Notification.permission !== 'granted') {
  Notification.requestPermission();
}

document.getElementById('userEmail').textContent = localStorage.getItem('email');

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  window.location.href = 'index.html';
});

async function fetchTodos() {
  const res = await fetch(API_URL + '/todos', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
    return [];
  }
  return res.json();
}

async function fetchSettings() {
  const res = await fetch(API_URL + '/settings', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.ok) {
    const settings = await res.json();
    if (settings.theme) {
      currentTheme = settings.theme;
      document.body.setAttribute('data-theme', currentTheme);
    }
  }
}

async function saveTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  await fetch(API_URL + '/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ theme })
  });
}

async function addTodo(title, notes, priority, dueDate, dueTime, reminder) {
  const res = await fetch(API_URL + '/todos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title, notes, priority, dueDate, dueTime, reminder })
  });
  return res.json();
}

async function updateTodo(id, data) {
  const res = await fetch(API_URL + '/todos/' + id, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function deleteTodo(id) {
  await fetch(API_URL + '/todos/' + id, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function isOverdue(dateStr, timeStr) {
  if (!dateStr) return false;
  const now = new Date();
  const due = new Date(dateStr + (timeStr ? 'T' + timeStr : ''));
  return due < now;
}

function checkReminders() {
  if (!('Notification' in window)) return;
  
  const now = new Date();
  todos.forEach(todo => {
    if (!todo.completed && todo.reminder && todo.dueDate && todo.dueTime) {
      const dueDateTime = new Date(todo.dueDate + 'T' + todo.dueTime);
      const diff = dueDateTime.getTime() - now.getTime();
      if (diff > -60000 && diff < 60000) {
        if (Notification.permission === 'granted') {
          new Notification('Todo Reminder: ' + todo.title, {
            body: todo.notes || 'This task is due now!',
            icon: 'https://cdn-icons-png.flaticon.com/512/2921/2921222.png'
          });
        }
      }
    }
  });
}

setInterval(checkReminders, 30000);

function updateStats() {
  const total = todos.length;
  const pending = todos.filter(t => !t.completed).length;
  const completed = todos.filter(t => t.completed).length;
  const highPriority = todos.filter(t => t.priority === 'high' && !t.completed).length;
  
  document.getElementById('totalCount').textContent = total;
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('completedCount').textContent = completed;
  document.getElementById('highPriorityCount').textContent = highPriority;
}

function filterTodos() {
  let filtered;
  if (currentFilter === 'pending') {
    filtered = todos.filter(t => !t.completed);
  } else if (currentFilter === 'completed') {
    filtered = todos.filter(t => t.completed);
  } else {
    filtered = todos;
  }
  return filtered;
}

async function render() {
  document.getElementById('loading').classList.add('active');
  document.getElementById('todoList').innerHTML = '';
  
  todos = await fetchTodos();
  await fetchSettings();
  
  document.getElementById('loading').classList.remove('active');
  updateStats();
  
  const filtered = filterTodos();
  const emptyMsg = document.getElementById('emptyMessage');
  
  if (todos.length === 0) {
    emptyMsg.textContent = 'Add your first task above!';
    document.getElementById('emptyState').style.display = 'block';
  } else if (filtered.length === 0) {
    if (currentFilter === 'pending') {
      emptyMsg.textContent = 'No pending tasks. Great job!';
    } else if (currentFilter === 'completed') {
      emptyMsg.textContent = 'No completed tasks yet.';
    }
    document.getElementById('emptyState').style.display = 'block';
  } else {
    document.getElementById('emptyState').style.display = 'none';
  }
  
  filtered.forEach((todo, index) => {
    const item = document.createElement('div');
    item.className = 'todo-item' + (todo.completed ? ' completed' : '');
    item.style.animationDelay = (index * 0.05) + 's';
    
    const priorityClass = todo.priority || 'medium';
    const dueOverdue = isOverdue(todo.dueDate, todo.dueTime) && !todo.completed;
    
    let metaHTML = '';
    if (todo.priority !== 'medium') {
      metaHTML += `<span class="todo-priority ${priorityClass}">${priorityClass}</span>`;
    }
    if (todo.dueDate) {
      metaHTML += `<span class="todo-due ${dueOverdue ? 'overdue' : ''}">
        <i class="fas fa-calendar"></i> ${formatDate(todo.dueDate)}${todo.dueTime ? ' ' + formatTime(todo.dueTime) : ''}
      </span>`;
    }
    if (todo.reminder) {
      metaHTML += `<span class="todo-reminder"><i class="fas fa-bell"></i> Reminder</span>`;
    }
    
    item.innerHTML = `
      <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" data-id="${todo._id}"></div>
      <div class="todo-content">
        <span class="todo-title">${escapeHTML(todo.title)}</span>
        ${todo.notes ? `<span class="todo-notes-preview">${escapeHTML(todo.notes)}</span>` : ''}
        <div class="todo-meta">${metaHTML}</div>
      </div>
      <div class="todo-actions">
        <button class="btn-edit" data-id="${todo._id}" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="btn-delete" data-id="${todo._id}" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    `;
    document.getElementById('todoList').appendChild(item);
  });
  
  document.querySelectorAll('.todo-checkbox').forEach(cb => {
    cb.addEventListener('click', async () => {
      const id = cb.dataset.id;
      const todo = todos.find(t => t._id === id);
      await updateTodo(id, { completed: !todo.completed });
      render();
    });
  });
  
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this task?')) {
        await deleteTodo(btn.dataset.id);
        render();
      }
    });
  });
  
  checkReminders();
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openEditModal(todoId) {
  const todo = todos.find(t => t._id === todoId);
  if (!todo) return;
  
  document.getElementById('editTodoId').value = todoId;
  document.getElementById('editTodoText').value = todo.title;
  document.getElementById('editTodoNotes').value = todo.notes || '';
  document.getElementById('editPriority').value = todo.priority || 'medium';
  document.getElementById('editDueDate').value = todo.dueDate || '';
  document.getElementById('editDueTime').value = todo.dueTime || '';
  document.getElementById('editReminder').checked = todo.reminder || false;
  
  document.getElementById('editModal').classList.add('active');
}

document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('editModal').classList.remove('active');
});

document.getElementById('cancelEdit').addEventListener('click', () => {
  document.getElementById('editModal').classList.remove('active');
});

document.getElementById('saveEdit').addEventListener('click', async () => {
  const id = document.getElementById('editTodoId').value;
  const title = document.getElementById('editTodoText').value.trim();
  const notes = document.getElementById('editTodoNotes').value.trim();
  const priority = document.getElementById('editPriority').value;
  const dueDate = document.getElementById('editDueDate').value || null;
  const dueTime = document.getElementById('editDueTime').value || null;
  const reminder = document.getElementById('editReminder').checked;
  
  if (!title) {
    alert('Please enter a task title');
    return;
  }
  
  await updateTodo(id, { title, notes, priority, dueDate, dueTime, reminder });
  document.getElementById('editModal').classList.remove('active');
  render();
});

document.getElementById('editModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('editModal')) {
    document.getElementById('editModal').classList.remove('active');
  }
});

document.getElementById('addBtn').addEventListener('click', async () => {
  const input = document.getElementById('todoInput');
  const notesInput = document.getElementById('todoNotes');
  const title = input.value.trim();
  const notes = notesInput.value.trim();
  const priority = document.getElementById('prioritySelect').value;
  const dueDate = document.getElementById('dueDate').value || null;
  const dueTime = document.getElementById('dueTime').value || null;
  const reminder = document.getElementById('reminderCheck').checked;
  
  if (title) {
    await addTodo(title, notes, priority, dueDate, dueTime, reminder);
    input.value = '';
    notesInput.value = '';
    document.getElementById('prioritySelect').value = 'medium';
    document.getElementById('dueDate').value = '';
    document.getElementById('dueTime').value = '';
    document.getElementById('reminderCheck').checked = false;
    render();
  }
});

document.getElementById('todoInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addBtn').click();
  }
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

const themeBtn = document.getElementById('themeBtn');
const themePicker = document.getElementById('themePicker');

themeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  themePicker.classList.toggle('active');
});

document.addEventListener('click', () => {
  themePicker.classList.remove('active');
});

document.querySelectorAll('.theme-option').forEach(option => {
  option.addEventListener('click', () => {
    const theme = option.dataset.theme;
    saveTheme(theme);
    themePicker.classList.remove('active');
  });
});

render();
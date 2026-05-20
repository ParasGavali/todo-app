const API_URL = 'http://localhost:3000/api';

let currentTab = 'login';

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
  });
});

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const endpoint = currentTab === 'login' ? '/login' : '/register';
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.textContent = 'Loading...';
  submitBtn.disabled = true;
  
  try {
    const res = await fetch(API_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('email', data.email);
      window.location.href = 'dashboard.html';
    } else {
      showError(data.message);
      submitBtn.textContent = 'Continue';
      submitBtn.disabled = false;
    }
  } catch (err) {
    showError('Unable to connect to server');
    submitBtn.textContent = 'Continue';
    submitBtn.disabled = false;
  }
});

function showError(msg) {
  let errorEl = document.querySelector('.error-msg');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.className = 'error-msg';
    document.querySelector('.auth-form').prepend(errorEl);
  }
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
  setTimeout(() => errorEl.style.display = 'none', 4000);
}

if (localStorage.getItem('token')) {
  window.location.href = 'dashboard.html';
}
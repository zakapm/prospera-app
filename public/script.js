function alternarAcao() {
  const loginSection = document.getElementById('login-section');
  const registerSection = document.getElementById('register-section');

  if (loginSection && registerSection) {
    if (loginSection.style.display === 'none') {
      loginSection.style.display = 'block';
      registerSection.style.display = 'none';
    } else {
      loginSection.style.display = 'none';
      registerSection.style.display = 'block';
    }
  }
}

function fazerLogout() {
  document.getElementById('dashboard-section').style.display = 'none';
  document.getElementById('auth-card').style.display = 'block';
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('register-section').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  // Cadastro
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
          alert('Conta criada com sucesso!');
          registerForm.reset();
          alternarAcao();
        } else {
          alert(data.error || 'Erro ao criar conta.');
        }
      } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao conectar ao servidor.');
      }
    });
  }

  // Login
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
          document.getElementById('auth-card').style.display = 'none';
          document.getElementById('dashboard-section').style.display = 'block';
          
          if (data.user && data.user.name) {
            document.getElementById('welcome-message').innerText = `Bem-vindo, ${data.user.name}!`;
          }
        } else {
          alert(data.error || 'E-mail ou senha incorretos.');
        }
      } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao conectar ao servidor.');
      }
    });
  }
});
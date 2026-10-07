// Função para alternar entre as telas de Login e Cadastro
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

document.addEventListener('DOMContentLoaded', () => {
  // Evento do Formulário de Cadastro
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name') ? document.getElementById('name').value : '';
      const email = document.getElementById('email') ? document.getElementById('email').value : '';
      const password = document.getElementById('password') ? document.getElementById('password').value : '';

      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
          alert('Conta criada com sucesso! Agora você pode fazer login.');
          registerForm.reset();
          alternarAcao(); // Volta para a tela de login
        } else {
          alert(data.error || 'Erro ao criar conta.');
        }
      } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro ao conectar ao servidor.');
      }
    });
  }

  // Evento do Formulário de Login
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('login-email') ? document.getElementById('login-email').value : '';
      const password = document.getElementById('login-password') ? document.getElementById('login-password').value : '';

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
          alert('Login realizado com sucesso!');
        } else {
          alert(data.error || 'E-mail ou senha incorretos.');
        }
      } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro ao conectar ao servidor.');
      }
    });
  }
});
//public/js/auth.js//
document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login-button');
    const loginModal = document.getElementById('login-modal');
    const closeButton = loginModal.querySelector('.close');
    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-button');

    // Otevření modálního okna pro přihlášení
    loginButton.addEventListener('click', () => {
        loginModal.style.display = 'block';
    });

    // Zavření modálního okna
    closeButton.addEventListener('click', () => {
        loginModal.style.display = 'none';
    });

    // Zavření modálního okna kliknutím mimo něj
    window.addEventListener('click', (event) => {
        if (event.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });

    // Zpracování přihlašovacího formuláře
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Úspěšné přihlášení
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                updateUserInterface(data.user);
                loginModal.style.display = 'none';
            } else {
                // Neúspěšné přihlášení
                alert(data.message || 'Přihlášení se nezdařilo');
            }
        } catch (error) {
            console.error('Chyba při přihlašování:', error);
            alert('Došlo k chybě při přihlašování');
        }
    });

    // Odhlášení
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        updateUserInterface(null);
    });

    // Kontrola, zda je uživatel přihlášen při načtení stránky
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        updateUserInterface(user);
    }
});

function updateUserInterface(user) {
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const userNameSpan = document.getElementById('user-name');

    if (user) {
        loginButton.style.display = 'none';
        logoutButton.style.display = 'inline-block';
        userNameSpan.style.display = 'inline';
        userNameSpan.textContent = user.name;
    } else {
        loginButton.style.display = 'inline-block';
        logoutButton.style.display = 'none';
        userNameSpan.style.display = 'none';
        userNameSpan.textContent = '';
    }
}
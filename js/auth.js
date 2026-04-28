/* ============================================
   Authentication Module
   JWT-based auth with localStorage persistence
   Supports email/password registration & login
   ============================================ */

const Auth = {
  KEYS: {
    USERS: 'dp_auth_users',
    SESSION: 'dp_auth_session',
  },

  /* Get all registered users */
  _getUsers() {
    try {
      const raw = localStorage.getItem(this.KEYS.USERS);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  /* Save users list */
  _saveUsers(users) {
    localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
  },

  /* Simple hash function for passwords (demo - use bcrypt in production) */
  async _hash(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'healthplus_salt_2025');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /* Generate a simple JWT-like token */
  _generateToken(user) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, /* 7 days */
    }));
    const signature = btoa(user.id + Date.now());
    return `${header}.${payload}.${signature}`;
  },

  /* Register a new user */
  async register(name, email, password) {
    const users = this._getUsers();

    if (users.find(u => u.email === email.toLowerCase())) {
      return { success: false, error: 'Email already registered' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    const hashedPassword = await this._hash(password);
    const user = {
      id: 'user_' + Date.now(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      avatar: name.trim().charAt(0).toUpperCase(),
    };

    users.push(user);
    this._saveUsers(users);

    const token = this._generateToken(user);
    this._setSession({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });

    return { success: true, user: { id: user.id, name: user.name, email: user.email } };
  },

  /* Login with email and password */
  async login(email, password) {
    const users = this._getUsers();
    const hashedPassword = await this._hash(password);
    const user = users.find(u => u.email === email.toLowerCase().trim() && u.password === hashedPassword);

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    const token = this._generateToken(user);
    this._setSession({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });

    return { success: true, user: { id: user.id, name: user.name, email: user.email } };
  },

  /* OAuth simulation - Google */
  async loginWithGoogle() {
    /* In production, this would redirect to Google OAuth */
    /* For demo, we create/login a demo Google user */
    const demoEmail = 'demo@google.healthplus.com';
    const users = this._getUsers();
    let user = users.find(u => u.email === demoEmail);

    if (!user) {
      user = {
        id: 'google_' + Date.now(),
        name: 'Google User',
        email: demoEmail,
        password: '',
        createdAt: new Date().toISOString(),
        avatar: 'G',
        provider: 'google',
      };
      users.push(user);
      this._saveUsers(users);
    }

    const token = this._generateToken(user);
    this._setSession({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
    return { success: true, user: { id: user.id, name: user.name, email: user.email } };
  },

  /* OAuth simulation - GitHub */
  async loginWithGithub() {
    const demoEmail = 'demo@github.healthplus.com';
    const users = this._getUsers();
    let user = users.find(u => u.email === demoEmail);

    if (!user) {
      user = {
        id: 'github_' + Date.now(),
        name: 'GitHub User',
        email: demoEmail,
        password: '',
        createdAt: new Date().toISOString(),
        avatar: 'G',
        provider: 'github',
      };
      users.push(user);
      this._saveUsers(users);
    }

    const token = this._generateToken(user);
    this._setSession({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
    return { success: true, user: { id: user.id, name: user.name, email: user.email } };
  },

  /* Session management */
  _setSession(session) {
    localStorage.setItem(this.KEYS.SESSION, JSON.stringify(session));
  },

  getSession() {
    try {
      const raw = localStorage.getItem(this.KEYS.SESSION);
      if (!raw) return null;
      const session = JSON.parse(raw);
      /* Check token expiry */
      const payload = JSON.parse(atob(session.token.split('.')[1]));
      if (payload.exp < Date.now()) {
        this.logout();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return this.getSession() !== null;
  },

  getCurrentUser() {
    const session = this.getSession();
    return session ? session.user : null;
  },

  logout() {
    localStorage.removeItem(this.KEYS.SESSION);
  },

  /* Protect a page - redirect to auth if not logged in */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'auth.html?redirect=' + encodeURIComponent(window.location.pathname);
      return false;
    }
    return true;
  },
};

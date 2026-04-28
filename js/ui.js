/* ============================================
   UI Utilities
   Shared navigation, toast notifications,
   and helper functions across all pages
   ============================================ */

const UI = {
  /**
   * Render the shared top navigation bar.
   * @param {string} activePage - Current page identifier
   */
  renderNav(activePage) {
    const nav = document.getElementById('top-nav');
    if (!nav) return;

    const links = [
      { id: 'home', label: 'Home', href: 'index.html' },
      { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
      { id: 'diet', label: 'Diet Plan', href: 'diet.html' },
      { id: 'tracker', label: 'Tracker', href: 'tracker.html' },
      { id: 'scanner', label: 'Scanner', href: 'scanner.html' },
      { id: 'photo', label: 'Photo Log', href: 'photo-log.html' },
      { id: 'coach', label: 'Coach', href: 'coach.html' },
      { id: 'analytics', label: 'Analytics', href: 'analytics.html' },
      { id: 'grocery', label: 'Grocery', href: 'grocery.html' },
      { id: 'profile', label: 'Profile', href: 'profile.html' },
      { id: 'reminder', label: 'Reminders', href: 'reminder.html' },
    ];

    nav.innerHTML = `
      <a href="index.html" class="logo">Health<span>+</span></a>
      ${Auth && Auth.isLoggedIn() ? '<span style="color: rgba(255,255,255,0.7); font-size: 13px; margin-left: 8px;">' + Auth.getCurrentUser().name + '</span>' : ''}
      <button class="mobile-toggle" onclick="UI.toggleMobileNav()" aria-label="Toggle menu">&#9776;</button>
      <nav id="nav-links">
        ${links.map(l => `<a href="${l.href}" class="${l.id === activePage ? 'active' : ''}">${l.label}</a>`).join('')}
      </nav>
    `;
  },

  /* Toggle mobile navigation menu */
  toggleMobileNav() {
    const navLinks = document.getElementById('nav-links');
    if (navLinks) navLinks.classList.toggle('open');
  },

  /**
   * Show a toast notification.
   * @param {string} message - Text to display
   * @param {string} [type='success'] - 'success', 'error', or 'warning'
   * @param {number} [duration=3000] - Duration in ms
   */
  showToast(message, type = 'success', duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Format a date string to readable format.
   * @param {string} dateStr - ISO date string (YYYY-MM-DD)
   * @returns {string} Formatted date
   */
  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';

    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },

  /**
   * Check if user profile is complete enough for calorie calculations.
   * @returns {boolean}
   */
  isProfileComplete() {
    const p = Storage.getProfile();
    return p.age && p.gender && p.height && p.weight;
  },

  /**
   * Show a prompt to complete profile if needed.
   * @param {HTMLElement} container - Element to show the prompt in
   */
  showProfilePrompt(container) {
    if (!this.isProfileComplete()) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px;">
          <div style="font-size: 48px; margin-bottom: 16px;">&#128100;</div>
          <h2 style="margin-bottom: 8px;">Complete Your Profile</h2>
          <p style="color: var(--text-secondary); margin-bottom: 20px;">
            Set up your profile to get personalized calorie targets, macro recommendations, and meal suggestions.
          </p>
          <a href="profile.html" class="btn btn-primary btn-lg">Set Up Profile</a>
        </div>
      `;
      return true;
    }
    return false;
  },
};

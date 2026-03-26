/**
 * Site i18n – Internationalization (language switcher)
 * Loads one locale file per language from locales/<lang>.json (best practice:
 * separate files per language, load on demand, cache in memory).
 *
 * How to add or edit translations:
 * 1. Edit the JSON file for that language: locales/en.json or locales/zh-Hant.json.
 * 2. Use the same keys in both files. Use dot notation in HTML: data-i18n="nav.home".
 * 3. For attributes: data-i18n-attr="aria-label:nav.toggleMenu".
 */

(function () {
  var I18N_STORAGE_KEY = 'site-lang';
  var I18N_DEFAULT = 'en';
  var I18N_SUPPORTED = ['en', 'zh-Hant', 'hi'];
  var LOCALES_BASE = (function () {
    var path = document.location.pathname || '';
    var dir = path.substring(0, path.lastIndexOf('/') + 1);
    return document.location.origin + dir;
  })();

  var localeCache = {};

  function getStoredLang() {
    try {
      var stored = localStorage.getItem(I18N_STORAGE_KEY);
      if (stored && I18N_SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (_) {}
    return I18N_DEFAULT;
  }

  function setStoredLang(lang) {
    try {
      localStorage.setItem(I18N_STORAGE_KEY, lang);
    } catch (_) {}
  }

  function getNested(obj, path) {
    var keys = path.split('.');
    var cur = obj;
    for (var i = 0; i < keys.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[keys[i]];
    }
    return cur;
  }

  function setDocumentLang(lang) {
    document.documentElement.lang = lang;
  }

  function applyTranslations(t) {
    if (!t) return;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var value = getNested(t, key);
      if (value != null && typeof value === 'string') {
        el.textContent = value;
      }
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      var spec = el.getAttribute('data-i18n-attr');
      if (!spec) return;
      var parts = spec.split(':').map(function (s) { return s.trim(); });
      var attr = parts[0];
      var key = parts[1];
      if (!attr || !key) return;
      var value = getNested(t, key);
      if (value != null && typeof value === 'string') {
        el.setAttribute(attr, value);
      }
    });

    var titleEl = document.querySelector('title');
    if (titleEl && t.metaTitle) titleEl.textContent = t.metaTitle;

    var descEl = document.querySelector('meta[name="description"]');
    if (descEl && t.metaDescription) descEl.setAttribute('content', t.metaDescription);
  }

  function loadLocale(lang, callback) {
    if (localeCache[lang]) {
      if (callback) callback(localeCache[lang]);
      return;
    }
    var url = LOCALES_BASE + 'locales/' + lang + '.json';
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Locale failed to load');
        return res.json();
      })
      .then(function (data) {
        localeCache[lang] = data;
        if (callback) callback(data);
      })
      .catch(function () {
        if (lang !== I18N_DEFAULT && I18N_SUPPORTED.indexOf(I18N_DEFAULT) !== -1) {
          loadLocale(I18N_DEFAULT, callback);
        } else if (callback) {
          callback(null);
        }
      });
  }

  function setLanguage(lang, callback) {
    if (I18N_SUPPORTED.indexOf(lang) === -1) lang = I18N_DEFAULT;
    setStoredLang(lang);
    setDocumentLang(lang);
    loadLocale(lang, function (t) {
      applyTranslations(t);
      updateSwitcherUI(lang);
      if (callback) callback();
    });
  }

  function updateSwitcherUI(activeLang) {
    var container = document.querySelector('.lang-switcher');
    if (!container) return;
    container.querySelectorAll('[data-lang]').forEach(function (btn) {
      var isActive = btn.getAttribute('data-lang') === activeLang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function initLanguageSwitcher() {
    var current = getStoredLang();
    setDocumentLang(current);
    loadLocale(current, function (t) {
      applyTranslations(t);
      updateSwitcherUI(current);

      var container = document.querySelector('.lang-switcher');
      if (!container) return;

      container.querySelectorAll('[data-lang]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var lang = this.getAttribute('data-lang');
          if (!lang || I18N_SUPPORTED.indexOf(lang) === -1) return;
          setLanguage(lang);
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanguageSwitcher);
  } else {
    initLanguageSwitcher();
  }
})();

(function() {
  'use strict';

  var script = document.currentScript;
  var apiUrl = (script && script.getAttribute('data-api-url')) || window.location.origin;
  var theme = (script && script.getAttribute('data-theme')) || 'dark';
  var position = (script && script.getAttribute('data-position')) || 'below';

  var COLORS = {
    dark: { bg: 'rgba(15,23,42,0.9)', text: '#e2e8f0', bar: '#1e293b', weak: '#ef4444', fair: '#f97316', good: '#eab308', strong: '#10b981' },
    light: { bg: 'rgba(255,255,255,0.95)', text: '#1e293b', bar: '#e2e8f0', weak: '#ef4444', fair: '#f97316', good: '#eab308', strong: '#10b981' }
  };
  var c = COLORS[theme] || COLORS.dark;

  function getColor(pct) {
    if (pct < 25) return c.weak;
    if (pct < 50) return c.fair;
    if (pct < 75) return c.good;
    return c.strong;
  }

  function getLabel(pct) {
    if (pct < 20) return 'Very Weak';
    if (pct < 40) return 'Weak';
    if (pct < 60) return 'Fair';
    if (pct < 80) return 'Strong';
    return 'Very Strong';
  }

  function analyze(password, meter) {
    if (!password) {
      meter.style.display = 'none';
      return;
    }
    meter.style.display = 'block';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl + '/api/analyze', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          var color = getColor(data.strength_percent);
          meter.innerHTML = '<div style="height:4px;background:' + c.bar + ';border-radius:2px;overflow:hidden">' +
            '<div style="height:100%;width:' + data.strength_percent + '%;background:' + color + ';border-radius:2px;transition:width 0.3s"></div></div>' +
            '<div style="display:flex;justify-content:space-between;margin-top:2px;font-size:11px;color:' + c.text + '">' +
            '<span>' + getLabel(data.strength_percent) + '</span>' +
            '<span>' + data.strength_percent + '%</span></div>';
        } catch(e) {}
      }
    };
    xhr.send(JSON.stringify({ password: password }));
  }

  var debounce = null;

  function attach(input) {
    if (input._pwguardAttached) return;
    input._pwguardAttached = true;

    var meter = document.createElement('div');
    meter.style.cssText = 'margin-top:4px;padding:0;display:none;';
    if (position === 'below') {
      input.parentNode.insertBefore(meter, input.nextSibling);
    } else {
      input.style.display = 'inline-block';
      input.style.width = '70%';
      meter.style.display = 'inline-block';
      meter.style.width = '28%';
      meter.style.marginLeft = '2%';
      input.parentNode.insertBefore(meter, input.nextSibling);
    }

    input.addEventListener('input', function() {
      clearTimeout(debounce);
      debounce = setTimeout(function() { analyze(input.value, meter); }, 300);
    });
  }

  function scan() {
    var inputs = document.querySelectorAll('input[type="password"]');
    for (var i = 0; i < inputs.length; i++) attach(inputs[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  var observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
})();

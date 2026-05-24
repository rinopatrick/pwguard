(function() {
  'use strict';

  var API_URL = 'http://localhost:8001';

  function getColor(pct) {
    if (pct < 25) return '#ef4444';
    if (pct < 50) return '#f97316';
    if (pct < 75) return '#eab308';
    return '#10b981';
  }

  function getLabel(pct) {
    if (pct < 20) return 'Very Weak';
    if (pct < 40) return 'Weak';
    if (pct < 60) return 'Fair';
    if (pct < 80) return 'Strong';
    return 'Very Strong';
  }

  function analyze(password, meter) {
    if (!password) { meter.style.display = 'none'; return; }
    meter.style.display = 'block';
    meter.querySelector('.pwg-bar-fill').style.width = '0%';
    meter.querySelector('.pwg-label').textContent = 'Checking...';

    fetch(API_URL + '/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var color = getColor(data.strength_percent);
      meter.querySelector('.pwg-bar-fill').style.width = data.strength_percent + '%';
      meter.querySelector('.pwg-bar-fill').style.backgroundColor = color;
      meter.querySelector('.pwg-label').textContent = getLabel(data.strength_percent) + ' (' + data.strength_percent + '%)';
      meter.querySelector('.pwg-label').style.color = color;
    })
    .catch(function() {
      meter.querySelector('.pwg-label').textContent = 'API unavailable';
    });
  }

  function createMeter(input) {
    if (input.dataset.pwgAttached) return;
    input.dataset.pwgAttached = 'true';

    var meter = document.createElement('div');
    meter.className = 'pwg-meter';
    meter.style.cssText = 'margin-top:4px;display:none;font-family:system-ui,sans-serif;';
    meter.innerHTML = '<div style="height:4px;background:#334155;border-radius:2px;overflow:hidden">' +
      '<div class="pwg-bar-fill" style="height:100%;width:0%;border-radius:2px;transition:width 0.3s,background-color 0.3s"></div></div>' +
      '<div class="pwg-label" style="display:flex;justify-content:flex-end;margin-top:2px;font-size:11px;color:#94a3b8"></div>';

    input.parentNode.insertBefore(meter, input.nextSibling);

    var debounce = null;
    input.addEventListener('input', function() {
      clearTimeout(debounce);
      debounce = setTimeout(function() { analyze(input.value, meter); }, 300);
    });
  }

  function scan() {
    var inputs = document.querySelectorAll('input[type="password"]');
    for (var i = 0; i < inputs.length; i++) createMeter(inputs[i]);
  }

  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();

/* Fesilent adaptation of the Apache ECharts Examples editor chrome. */
(function () {
  'use strict';
  function requestClose() {
    if (window.self !== window.top) {
      window.parent.postMessage({ type: 'fesilent-echarts-editor-close' }, location.origin);
    }
  }
  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') requestClose();
  });
  document.querySelectorAll('[data-editor-view]').forEach(function (button) {
    button.addEventListener('click', function () {
      var codeView = button.dataset.editorView === 'code';
      document.body.classList.toggle('fesilent-show-code', codeView);
      document.querySelectorAll('[data-editor-view]').forEach(function (tab) {
        tab.setAttribute('aria-pressed', String(tab === button));
      });
      window.dispatchEvent(new Event('resize'));
    });
  });
  try {
    window.echartsExample.init('#main', {
      locale: 'zh',
      cdnRoot: new URL('/echarts-official', location.href).href,
      page: 'editor',
      version: '88ca004030e999073a15303e5fe32462b8fefae2'
    });
    if (window.self !== window.top) {
      window.parent.postMessage({ type: 'fesilent-echarts-editor-ready' }, location.origin);
    }
  } catch (error) {
    var message = document.createElement('p');
    message.className = 'fesilent-editor-error';
    message.textContent = '编辑器加载失败，请刷新后重试。';
    document.getElementById('main').appendChild(message);
    console.error('ECharts editor initialization failed', error);
  }
})();

import { store } from '../common/store';
import { URL_PARAMS, getScriptURLs } from '../common/config';
import { downloadBlob } from '../common/helper';

export function download(sourceHeader, runtimeScripts, chartCSS) {
  const SCRIPT_URLS = getScriptURLs(store.locale);
  const sourceCode = store.runCode || store.sourceCode;
  const rootPathCode = sourceCode.indexOf('ROOT_PATH') > -1
    ? `var ROOT_PATH = ${JSON.stringify(store.cdnRoot)};` : '';
  const cdnPathCode = sourceCode.indexOf('CDN_PATH') > -1
    ? `var CDN_PATH = ${JSON.stringify(store.cdnPath)};` : '';
  const scripts = (runtimeScripts || [{
    src: SCRIPT_URLS.latestEChartsDir + SCRIPT_URLS.echartsJS
  }]).slice();
  if (/\$[.\(]+/g.test(sourceCode)) {
    scripts.unshift({ src: SCRIPT_URLS.jQueryJS });
  }
  const scriptTags = scripts.map((script) => `<script type="text/javascript" src="${
    script.src.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  }"></script>`).join('\n  ');
  const theme = store.darkMode ? 'dark' : store.theme || null;

  const code = `<!--
${sourceHeader}
-->
<!DOCTYPE html>
<html lang="${store.locale === 'zh' ? 'zh-CN' : 'en'}" style="height: 100%">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${(chartCSS || '').replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body style="height: 100%; margin: 0">
  <div id="chart-container" style="height: 100%"></div>
  ${scriptTags}
  <script type="text/javascript">
    var dom = document.getElementById('chart-container');
    var myChart = echarts.init(dom, ${JSON.stringify(theme)}, {
      renderer: ${JSON.stringify(store.renderer)},
      useDirtyRect: ${store.useDirtyRect}
    });
    var app = {};
    ${rootPathCode}
    ${cdnPathCode}
    var css, option;

    ${sourceCode.replace(/<\/script/gi, '<\\/script')}

    if (typeof css === 'string') {
      var style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
    if (option && typeof option === 'object') {
      myChart.setOption(option);
    }
    window.addEventListener('resize', myChart.resize);
  </script>
</body>
</html>`;
  const file = new Blob([code], {
    type: 'text/html;charset=UTF-8',
    encoding: 'UTF-8'
  });
  downloadBlob(file, (URL_PARAMS.c || Date.now()) + '.html');
}

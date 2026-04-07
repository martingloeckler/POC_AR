(function attachPocAr8thWallBridge(global) {
  'use strict';

  function assertRuntime() {
    var runtime = global.PocAr8thWallRuntime;
    if (!runtime || typeof runtime.initImageTargetDemo !== 'function') {
      throw new Error(
        'PocAr8thWallRuntime.initImageTargetDemo fehlt. Lege den exportierten 8th-Wall-Runtime-Adapter unter public/8thwall/ ab und expose ihn auf window.PocAr8thWallRuntime.',
      );
    }
    return runtime;
  }

  async function initImageTargetDemo(options) {
    var runtime = assertRuntime();
    var cleanup = await runtime.initImageTargetDemo(options);

    if (typeof cleanup !== 'function') {
      return function noopCleanup() {};
    }

    return cleanup;
  }

  global.PocAr8thWallBridge = {
    initImageTargetDemo: initImageTargetDemo,
  };
})(window);

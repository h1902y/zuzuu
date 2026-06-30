/* @ds-bundle: {"namespace":"ZuzuuDS","components":[{"name":"Badge","sourcePath":"components/landing/Badge/Badge.jsx"},{"name":"Button","sourcePath":"components/landing/Button/Button.jsx"},{"name":"CardGrid","sourcePath":"components/landing/CardGrid/CardGrid.jsx"},{"name":"ComparisonTable","sourcePath":"components/landing/ComparisonTable/ComparisonTable.jsx"},{"name":"GridCell","sourcePath":"components/landing/GridCell/GridCell.jsx"},{"name":"Hero","sourcePath":"components/landing/Hero/Hero.jsx"},{"name":"InkCTA","sourcePath":"components/landing/InkCTA/InkCTA.jsx"},{"name":"Lead","sourcePath":"components/landing/Lead/Lead.jsx"},{"name":"Marquee","sourcePath":"components/landing/Marquee/Marquee.jsx"},{"name":"Overline","sourcePath":"components/landing/Overline/Overline.jsx"},{"name":"PointList","sourcePath":"components/landing/PointList/PointList.jsx"},{"name":"Section","sourcePath":"components/landing/Section/Section.jsx"},{"name":"SectionHeading","sourcePath":"components/landing/SectionHeading/SectionHeading.jsx"},{"name":"StatStrip","sourcePath":"components/landing/StatStrip/StatStrip.jsx"},{"name":"StepCard","sourcePath":"components/landing/StepCard/StepCard.jsx"},{"name":"Tag","sourcePath":"components/landing/Tag/Tag.jsx"},{"name":"TierCard","sourcePath":"components/landing/TierCard/TierCard.jsx"},{"name":"TrustBar","sourcePath":"components/landing/TrustBar/TrustBar.jsx"},{"name":"Wordmark","sourcePath":"components/landing/Wordmark/Wordmark.jsx"}],"sourceHashes":{"components/landing/Badge/Badge.jsx":"43f99c09096f","components/landing/Badge/Badge.d.ts":"794b4c833679","components/landing/Badge/Badge.prompt.md":"bd68ff9468fd","components/landing/Button/Button.jsx":"3b81548feaa7","components/landing/Button/Button.d.ts":"d00c6ac7d8e0","components/landing/Button/Button.prompt.md":"f7bb081fc1a5","components/landing/CardGrid/CardGrid.jsx":"4bd92c81ea67","components/landing/CardGrid/CardGrid.d.ts":"c7c49f1b744e","components/landing/CardGrid/CardGrid.prompt.md":"8267a0978f95","components/landing/ComparisonTable/ComparisonTable.jsx":"87538b088995","components/landing/ComparisonTable/ComparisonTable.d.ts":"7ee6c88dc2a8","components/landing/ComparisonTable/ComparisonTable.prompt.md":"5297fba30236","components/landing/GridCell/GridCell.jsx":"96cfc4a56234","components/landing/GridCell/GridCell.d.ts":"cfcdca7675aa","components/landing/GridCell/GridCell.prompt.md":"f6f82e9478d3","components/landing/Hero/Hero.jsx":"377fabe6afc9","components/landing/Hero/Hero.d.ts":"f3f4baf80b9c","components/landing/Hero/Hero.prompt.md":"aa74a28354e8","components/landing/InkCTA/InkCTA.jsx":"44f1380c702c","components/landing/InkCTA/InkCTA.d.ts":"381ddc1e4897","components/landing/InkCTA/InkCTA.prompt.md":"46944972698a","components/landing/Lead/Lead.jsx":"cfdb56ff4eba","components/landing/Lead/Lead.d.ts":"5cb26e353951","components/landing/Lead/Lead.prompt.md":"222078c14998","components/landing/Marquee/Marquee.jsx":"cabe2db075ad","components/landing/Marquee/Marquee.d.ts":"a21e391543eb","components/landing/Marquee/Marquee.prompt.md":"39a2a3e9f2b1","components/landing/Overline/Overline.jsx":"831f84b2a9ec","components/landing/Overline/Overline.d.ts":"921168846205","components/landing/Overline/Overline.prompt.md":"75d87aa31ce9","components/landing/PointList/PointList.jsx":"e009e9b41b5e","components/landing/PointList/PointList.d.ts":"0ae2883f19e6","components/landing/PointList/PointList.prompt.md":"22aaf19b716a","components/landing/Section/Section.jsx":"c2985805a2e9","components/landing/Section/Section.d.ts":"e960b9464bf5","components/landing/Section/Section.prompt.md":"92852da24fca","components/landing/SectionHeading/SectionHeading.jsx":"151cf344a902","components/landing/SectionHeading/SectionHeading.d.ts":"b8ab59c3b0d0","components/landing/SectionHeading/SectionHeading.prompt.md":"deb1e65d7087","components/landing/StatStrip/StatStrip.jsx":"afe207aa3947","components/landing/StatStrip/StatStrip.d.ts":"771ce202a921","components/landing/StatStrip/StatStrip.prompt.md":"a7c85361d64a","components/landing/StepCard/StepCard.jsx":"c8c2dcf1c3f5","components/landing/StepCard/StepCard.d.ts":"6168d00bb33b","components/landing/StepCard/StepCard.prompt.md":"b64192f86592","components/landing/Tag/Tag.jsx":"2a6866596272","components/landing/Tag/Tag.d.ts":"bb8949015c6d","components/landing/Tag/Tag.prompt.md":"3823dccd39e5","components/landing/TierCard/TierCard.jsx":"d409e24efacd","components/landing/TierCard/TierCard.d.ts":"d145f6dced43","components/landing/TierCard/TierCard.prompt.md":"0a146f616f63","components/landing/TrustBar/TrustBar.jsx":"30e63e52a0db","components/landing/TrustBar/TrustBar.d.ts":"affc8284be89","components/landing/TrustBar/TrustBar.prompt.md":"0c873d36dde3","components/landing/Wordmark/Wordmark.jsx":"153ed541ea7c","components/landing/Wordmark/Wordmark.d.ts":"32c4d6263063","components/landing/Wordmark/Wordmark.prompt.md":"184785763d34"},"inlinedExternals":["@swc/helpers","clsx","lucide-react","next","tailwind-merge"],"builtBy":"cc-design-sync"} */
"use strict";
var ZuzuuDS = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function np(p, k) {
        var o = {};
        for (var x in p) if (x !== "children") o[x] = p[x];
        if (k !== void 0) o.key = k;
        return o;
      }
      function jsx20(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs15(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx20;
      module.exports.jsxs = jsxs15;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs15 : jsx20)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // node_modules/@swc/helpers/cjs/_interop_require_default.cjs
  var require_interop_require_default = __commonJS({
    "node_modules/@swc/helpers/cjs/_interop_require_default.cjs"(exports) {
      "use strict";
      init_define_import_meta_env();
      function _interop_require_default(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }
      exports._ = _interop_require_default;
    }
  });

  // node_modules/next/dist/shared/lib/utils/warn-once.js
  var require_warn_once = __commonJS({
    "node_modules/next/dist/shared/lib/utils/warn-once.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "warnOnce", {
        enumerable: true,
        get: function() {
          return warnOnce;
        }
      });
      var warnOnce = (_) => {
      };
      if (true) {
        const warnings = /* @__PURE__ */ new Set();
        warnOnce = (msg) => {
          if (!warnings.has(msg)) {
            console.warn(msg);
          }
          warnings.add(msg);
        };
      }
    }
  });

  // node_modules/next/dist/shared/lib/deployment-id.js
  var require_deployment_id = __commonJS({
    "node_modules/next/dist/shared/lib/deployment-id.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: all[name]
        });
      }
      _export(exports, {
        getAssetToken: function() {
          return getAssetToken;
        },
        getAssetTokenQuery: function() {
          return getAssetTokenQuery;
        },
        getDeploymentId: function() {
          return getDeploymentId;
        },
        getDeploymentIdQuery: function() {
          return getDeploymentIdQuery;
        }
      });
      var deploymentId;
      if (typeof window !== "undefined") {
        deploymentId = document.documentElement.dataset.dplId;
        delete document.documentElement.dataset.dplId;
      } else {
        deploymentId = process.env.NEXT_DEPLOYMENT_ID || void 0;
      }
      function getDeploymentId() {
        return deploymentId;
      }
      function getDeploymentIdQuery(ampersand = false) {
        let id = getDeploymentId();
        if (id) {
          return `${ampersand ? "&" : "?"}dpl=${id}`;
        }
        return "";
      }
      function getAssetToken() {
        return process.env.NEXT_IMMUTABLE_ASSET_TOKEN || process.env.NEXT_DEPLOYMENT_ID;
      }
      function getAssetTokenQuery(ampersand = false) {
        let id = getAssetToken();
        if (id) {
          return `${ampersand ? "&" : "?"}dpl=${id}`;
        }
        return "";
      }
    }
  });

  // node_modules/next/dist/shared/lib/image-blur-svg.js
  var require_image_blur_svg = __commonJS({
    "node_modules/next/dist/shared/lib/image-blur-svg.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "getImageBlurSvg", {
        enumerable: true,
        get: function() {
          return getImageBlurSvg;
        }
      });
      function getImageBlurSvg({ widthInt, heightInt, blurWidth, blurHeight, blurDataURL, objectFit }) {
        const std = 20;
        const svgWidth = blurWidth ? blurWidth * 40 : widthInt;
        const svgHeight = blurHeight ? blurHeight * 40 : heightInt;
        const viewBox = svgWidth && svgHeight ? `viewBox='0 0 ${svgWidth} ${svgHeight}'` : "";
        const preserveAspectRatio = viewBox ? "none" : objectFit === "contain" ? "xMidYMid" : objectFit === "cover" ? "xMidYMid slice" : "none";
        return `%3Csvg xmlns='http://www.w3.org/2000/svg' ${viewBox}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${preserveAspectRatio}' style='filter: url(%23b);' href='${blurDataURL}'/%3E%3C/svg%3E`;
      }
    }
  });

  // node_modules/next/dist/shared/lib/image-config.js
  var require_image_config = __commonJS({
    "node_modules/next/dist/shared/lib/image-config.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: all[name]
        });
      }
      _export(exports, {
        VALID_LOADERS: function() {
          return VALID_LOADERS;
        },
        imageConfigDefault: function() {
          return imageConfigDefault;
        }
      });
      var VALID_LOADERS = [
        "default",
        "imgix",
        "cloudinary",
        "akamai",
        "custom"
      ];
      var imageConfigDefault = {
        deviceSizes: [
          640,
          750,
          828,
          1080,
          1200,
          1920,
          2048,
          3840
        ],
        imageSizes: [
          32,
          48,
          64,
          96,
          128,
          256,
          384
        ],
        path: "/_next/image",
        loader: "default",
        loaderFile: "",
        /**
        * @deprecated Use `remotePatterns` instead to protect your application from malicious users.
        */
        domains: [],
        disableStaticImages: false,
        minimumCacheTTL: 14400,
        formats: [
          "image/webp"
        ],
        maximumDiskCacheSize: void 0,
        maximumRedirects: 3,
        maximumResponseBody: 5e7,
        dangerouslyAllowLocalIP: false,
        dangerouslyAllowSVG: false,
        contentSecurityPolicy: `script-src 'none'; frame-src 'none'; sandbox;`,
        contentDispositionType: "attachment",
        localPatterns: void 0,
        remotePatterns: [],
        qualities: [
          75
        ],
        unoptimized: false,
        customCacheHandler: false
      };
    }
  });

  // node_modules/next/dist/shared/lib/get-img-props.js
  var require_get_img_props = __commonJS({
    "node_modules/next/dist/shared/lib/get-img-props.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "getImgProps", {
        enumerable: true,
        get: function() {
          return getImgProps;
        }
      });
      var _warnonce = require_warn_once();
      var _deploymentid = require_deployment_id();
      var _imageblursvg = require_image_blur_svg();
      var _imageconfig = require_image_config();
      var VALID_LOADING_VALUES = [
        "lazy",
        "eager",
        void 0
      ];
      var INVALID_BACKGROUND_SIZE_VALUES = [
        "-moz-initial",
        "fill",
        "none",
        "scale-down",
        void 0
      ];
      function isStaticRequire(src) {
        return src.default !== void 0;
      }
      function isStaticImageData(src) {
        return src.src !== void 0;
      }
      function isStaticImport(src) {
        return !!src && typeof src === "object" && (isStaticRequire(src) || isStaticImageData(src));
      }
      var allImgs = /* @__PURE__ */ new Map();
      var perfObserver;
      function getInt(x) {
        if (typeof x === "undefined") {
          return x;
        }
        if (typeof x === "number") {
          return Number.isFinite(x) ? x : NaN;
        }
        if (typeof x === "string" && /^[0-9]+$/.test(x)) {
          return parseInt(x, 10);
        }
        return NaN;
      }
      function getWidths({ deviceSizes, allSizes }, width, sizes) {
        if (sizes) {
          const viewportWidthRe = /(^|\s)(1?\d?\d)vw/g;
          const percentSizes = [];
          for (let match; match = viewportWidthRe.exec(sizes); match) {
            percentSizes.push(parseInt(match[2]));
          }
          if (percentSizes.length) {
            const smallestRatio = Math.min(...percentSizes) * 0.01;
            return {
              widths: allSizes.filter((s) => s >= deviceSizes[0] * smallestRatio),
              kind: "w"
            };
          }
          return {
            widths: allSizes,
            kind: "w"
          };
        }
        if (typeof width !== "number") {
          return {
            widths: deviceSizes,
            kind: "w"
          };
        }
        const widths = [
          ...new Set(
            // > This means that most OLED screens that say they are 3x resolution,
            // > are actually 3x in the green color, but only 1.5x in the red and
            // > blue colors. Showing a 3x resolution image in the app vs a 2x
            // > resolution image will be visually the same, though the 3x image
            // > takes significantly more data. Even true 3x resolution screens are
            // > wasteful as the human eye cannot see that level of detail without
            // > something like a magnifying glass.
            // https://blog.twitter.com/engineering/en_us/topics/infrastructure/2019/capping-image-fidelity-on-ultra-high-resolution-devices.html
            [
              width,
              width * 2
              /*, width * 3*/
            ].map((w) => allSizes.find((p) => p >= w) || allSizes[allSizes.length - 1])
          )
        ];
        return {
          widths,
          kind: "x"
        };
      }
      function generateImgAttrs({ config, src, unoptimized, width, quality, sizes, loader }) {
        if (unoptimized) {
          if (src.startsWith("/") && !src.startsWith("//")) {
            let deploymentId = (0, _deploymentid.getDeploymentId)();
            if (deploymentId) {
              const qIndex = src.indexOf("?");
              if (qIndex !== -1) {
                const params = new URLSearchParams(src.slice(qIndex + 1));
                const srcDpl = params.get("dpl");
                if (!srcDpl) {
                  params.append("dpl", deploymentId);
                  src = src.slice(0, qIndex) + "?" + params.toString();
                }
              } else {
                src = src + `?dpl=${deploymentId}`;
              }
            }
          }
          return {
            src,
            srcSet: void 0,
            sizes: void 0
          };
        }
        const { widths, kind } = getWidths(config, width, sizes);
        const last = widths.length - 1;
        return {
          sizes: !sizes && kind === "w" ? "100vw" : sizes,
          srcSet: widths.map((w, i) => `${loader({
            config,
            src,
            quality,
            width: w
          })} ${kind === "w" ? w : i + 1}${kind}`).join(", "),
          // It's intended to keep `src` the last attribute because React updates
          // attributes in order. If we keep `src` the first one, Safari will
          // immediately start to fetch `src`, before `sizes` and `srcSet` are even
          // updated by React. That causes multiple unnecessary requests if `srcSet`
          // and `sizes` are defined.
          // This bug cannot be reproduced in Chrome or Firefox.
          src: loader({
            config,
            src,
            quality,
            width: widths[last]
          })
        };
      }
      function getImgProps({ src, sizes, unoptimized = false, priority = false, preload = false, loading, className, quality, width, height, fill = false, style, overrideSrc, onLoad, onLoadingComplete, placeholder = "empty", blurDataURL, fetchPriority, decoding = "async", layout, objectFit, objectPosition, lazyBoundary, lazyRoot, ...rest }, _state) {
        const { imgConf, showAltText, blurComplete, defaultLoader } = _state;
        let config;
        let c = imgConf || _imageconfig.imageConfigDefault;
        if ("allSizes" in c) {
          config = c;
        } else {
          const allSizes = [
            ...c.deviceSizes,
            ...c.imageSizes
          ].sort((a, b) => a - b);
          const deviceSizes = c.deviceSizes.sort((a, b) => a - b);
          const qualities = c.qualities?.sort((a, b) => a - b);
          config = {
            ...c,
            allSizes,
            deviceSizes,
            qualities
          };
        }
        if (typeof defaultLoader === "undefined") {
          throw Object.defineProperty(new Error("images.loaderFile detected but the file is missing default export.\nRead more: https://nextjs.org/docs/messages/invalid-images-config"), "__NEXT_ERROR_CODE", {
            value: "E163",
            enumerable: false,
            configurable: true
          });
        }
        let loader = rest.loader || defaultLoader;
        delete rest.loader;
        delete rest.srcSet;
        const isDefaultLoader = "__next_img_default" in loader;
        if (isDefaultLoader) {
          if (config.loader === "custom") {
            throw Object.defineProperty(new Error(`Image with src "${src}" is missing "loader" prop.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader`), "__NEXT_ERROR_CODE", {
              value: "E252",
              enumerable: false,
              configurable: true
            });
          }
        } else {
          const customImageLoader = loader;
          loader = (obj) => {
            const { config: _, ...opts } = obj;
            return customImageLoader(opts);
          };
        }
        if (layout) {
          if (layout === "fill") {
            fill = true;
          }
          const layoutToStyle = {
            intrinsic: {
              maxWidth: "100%",
              height: "auto"
            },
            responsive: {
              width: "100%",
              height: "auto"
            }
          };
          const layoutToSizes = {
            responsive: "100vw",
            fill: "100vw"
          };
          const layoutStyle = layoutToStyle[layout];
          if (layoutStyle) {
            style = {
              ...style,
              ...layoutStyle
            };
          }
          const layoutSizes = layoutToSizes[layout];
          if (layoutSizes && !sizes) {
            sizes = layoutSizes;
          }
        }
        let staticSrc = "";
        let widthInt = getInt(width);
        let heightInt = getInt(height);
        let blurWidth;
        let blurHeight;
        if (isStaticImport(src)) {
          const staticImageData = isStaticRequire(src) ? src.default : src;
          if (!staticImageData.src) {
            throw Object.defineProperty(new Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include src. Received ${JSON.stringify(staticImageData)}`), "__NEXT_ERROR_CODE", {
              value: "E460",
              enumerable: false,
              configurable: true
            });
          }
          if (!staticImageData.height || !staticImageData.width) {
            throw Object.defineProperty(new Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include height and width. Received ${JSON.stringify(staticImageData)}`), "__NEXT_ERROR_CODE", {
              value: "E48",
              enumerable: false,
              configurable: true
            });
          }
          blurWidth = staticImageData.blurWidth;
          blurHeight = staticImageData.blurHeight;
          blurDataURL = blurDataURL || staticImageData.blurDataURL;
          staticSrc = staticImageData.src;
          if (!fill) {
            if (!widthInt && !heightInt) {
              widthInt = staticImageData.width;
              heightInt = staticImageData.height;
            } else if (widthInt && !heightInt) {
              const ratio = widthInt / staticImageData.width;
              heightInt = Math.round(staticImageData.height * ratio);
            } else if (!widthInt && heightInt) {
              const ratio = heightInt / staticImageData.height;
              widthInt = Math.round(staticImageData.width * ratio);
            }
          }
        }
        src = typeof src === "string" ? src : staticSrc;
        let isLazy = !priority && !preload && (loading === "lazy" || typeof loading === "undefined");
        if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
          unoptimized = true;
          isLazy = false;
        }
        if (config.unoptimized) {
          unoptimized = true;
        }
        if (isDefaultLoader && !config.dangerouslyAllowSVG && src.split("?", 1)[0].endsWith(".svg")) {
          unoptimized = true;
        }
        const qualityInt = getInt(quality);
        if (true) {
          if (config.output === "export" && isDefaultLoader && !unoptimized) {
            throw Object.defineProperty(new Error(`Image Optimization using the default loader is not compatible with \`{ output: 'export' }\`.
  Possible solutions:
    - Remove \`{ output: 'export' }\` and run "next start" to run server mode including the Image Optimization API.
    - Configure \`{ images: { unoptimized: true } }\` in \`next.config.js\` to disable the Image Optimization API.
  Read more: https://nextjs.org/docs/messages/export-image-api`), "__NEXT_ERROR_CODE", {
              value: "E500",
              enumerable: false,
              configurable: true
            });
          }
          if (!src) {
            unoptimized = true;
          } else {
            if (fill) {
              if (width) {
                throw Object.defineProperty(new Error(`Image with src "${src}" has both "width" and "fill" properties. Only one should be used.`), "__NEXT_ERROR_CODE", {
                  value: "E96",
                  enumerable: false,
                  configurable: true
                });
              }
              if (height) {
                throw Object.defineProperty(new Error(`Image with src "${src}" has both "height" and "fill" properties. Only one should be used.`), "__NEXT_ERROR_CODE", {
                  value: "E115",
                  enumerable: false,
                  configurable: true
                });
              }
              if (style?.position && style.position !== "absolute") {
                throw Object.defineProperty(new Error(`Image with src "${src}" has both "fill" and "style.position" properties. Images with "fill" always use position absolute - it cannot be modified.`), "__NEXT_ERROR_CODE", {
                  value: "E216",
                  enumerable: false,
                  configurable: true
                });
              }
              if (style?.width && style.width !== "100%") {
                throw Object.defineProperty(new Error(`Image with src "${src}" has both "fill" and "style.width" properties. Images with "fill" always use width 100% - it cannot be modified.`), "__NEXT_ERROR_CODE", {
                  value: "E73",
                  enumerable: false,
                  configurable: true
                });
              }
              if (style?.height && style.height !== "100%") {
                throw Object.defineProperty(new Error(`Image with src "${src}" has both "fill" and "style.height" properties. Images with "fill" always use height 100% - it cannot be modified.`), "__NEXT_ERROR_CODE", {
                  value: "E404",
                  enumerable: false,
                  configurable: true
                });
              }
            } else {
              if (typeof widthInt === "undefined") {
                throw Object.defineProperty(new Error(`Image with src "${src}" is missing required "width" property.`), "__NEXT_ERROR_CODE", {
                  value: "E451",
                  enumerable: false,
                  configurable: true
                });
              } else if (isNaN(widthInt)) {
                throw Object.defineProperty(new Error(`Image with src "${src}" has invalid "width" property. Expected a numeric value in pixels but received "${width}".`), "__NEXT_ERROR_CODE", {
                  value: "E66",
                  enumerable: false,
                  configurable: true
                });
              }
              if (typeof heightInt === "undefined") {
                throw Object.defineProperty(new Error(`Image with src "${src}" is missing required "height" property.`), "__NEXT_ERROR_CODE", {
                  value: "E397",
                  enumerable: false,
                  configurable: true
                });
              } else if (isNaN(heightInt)) {
                throw Object.defineProperty(new Error(`Image with src "${src}" has invalid "height" property. Expected a numeric value in pixels but received "${height}".`), "__NEXT_ERROR_CODE", {
                  value: "E444",
                  enumerable: false,
                  configurable: true
                });
              }
              if (/^[\x00-\x20]/.test(src)) {
                throw Object.defineProperty(new Error(`Image with src "${src}" cannot start with a space or control character. Use src.trimStart() to remove it or encodeURIComponent(src) to keep it.`), "__NEXT_ERROR_CODE", {
                  value: "E176",
                  enumerable: false,
                  configurable: true
                });
              }
              if (/[\x00-\x20]$/.test(src)) {
                throw Object.defineProperty(new Error(`Image with src "${src}" cannot end with a space or control character. Use src.trimEnd() to remove it or encodeURIComponent(src) to keep it.`), "__NEXT_ERROR_CODE", {
                  value: "E21",
                  enumerable: false,
                  configurable: true
                });
              }
            }
          }
          if (!VALID_LOADING_VALUES.includes(loading)) {
            throw Object.defineProperty(new Error(`Image with src "${src}" has invalid "loading" property. Provided "${loading}" should be one of ${VALID_LOADING_VALUES.map(String).join(",")}.`), "__NEXT_ERROR_CODE", {
              value: "E357",
              enumerable: false,
              configurable: true
            });
          }
          if (priority && loading === "lazy") {
            throw Object.defineProperty(new Error(`Image with src "${src}" has both "priority" and "loading='lazy'" properties. Only one should be used.`), "__NEXT_ERROR_CODE", {
              value: "E218",
              enumerable: false,
              configurable: true
            });
          }
          if (preload && loading === "lazy") {
            throw Object.defineProperty(new Error(`Image with src "${src}" has both "preload" and "loading='lazy'" properties. Only one should be used.`), "__NEXT_ERROR_CODE", {
              value: "E803",
              enumerable: false,
              configurable: true
            });
          }
          if (preload && priority) {
            throw Object.defineProperty(new Error(`Image with src "${src}" has both "preload" and "priority" properties. Only "preload" should be used.`), "__NEXT_ERROR_CODE", {
              value: "E802",
              enumerable: false,
              configurable: true
            });
          }
          if (placeholder !== "empty" && placeholder !== "blur" && !placeholder.startsWith("data:image/")) {
            throw Object.defineProperty(new Error(`Image with src "${src}" has invalid "placeholder" property "${placeholder}".`), "__NEXT_ERROR_CODE", {
              value: "E431",
              enumerable: false,
              configurable: true
            });
          }
          if (placeholder !== "empty") {
            if (widthInt && heightInt && widthInt * heightInt < 1600) {
              (0, _warnonce.warnOnce)(`Image with src "${src}" is smaller than 40x40. Consider removing the "placeholder" property to improve performance.`);
            }
          }
          if (qualityInt && config.qualities && !config.qualities.includes(qualityInt)) {
            (0, _warnonce.warnOnce)(`Image with src "${src}" is using quality "${qualityInt}" which is not configured in images.qualities [${config.qualities.join(", ")}]. Please update your config to [${[
              ...config.qualities,
              qualityInt
            ].sort().join(", ")}].
Read more: https://nextjs.org/docs/messages/next-image-unconfigured-qualities`);
          }
          if (placeholder === "blur" && !blurDataURL) {
            const VALID_BLUR_EXT = [
              "jpeg",
              "png",
              "webp",
              "avif"
            ];
            throw Object.defineProperty(new Error(`Image with src "${src}" has "placeholder='blur'" property but is missing the "blurDataURL" property.
        Possible solutions:
          - Add a "blurDataURL" property, the contents should be a small Data URL to represent the image
          - Change the "src" property to a static import with one of the supported file types: ${VALID_BLUR_EXT.join(",")} (animated images not supported)
          - Remove the "placeholder" property, effectively no blur effect
        Read more: https://nextjs.org/docs/messages/placeholder-blur-data-url`), "__NEXT_ERROR_CODE", {
              value: "E371",
              enumerable: false,
              configurable: true
            });
          }
          if ("ref" in rest) {
            (0, _warnonce.warnOnce)(`Image with src "${src}" is using unsupported "ref" property. Consider using the "onLoad" property instead.`);
          }
          if (!unoptimized && !isDefaultLoader) {
            const urlStr = loader({
              config,
              src,
              width: widthInt || 400,
              quality: qualityInt || 75
            });
            let url;
            try {
              url = new URL(urlStr);
            } catch (err) {
            }
            if (urlStr === src || url && url.pathname === src && !url.search) {
              (0, _warnonce.warnOnce)(`Image with src "${src}" has a "loader" property that does not implement width. Please implement it or use the "unoptimized" property instead.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader-width`);
            }
          }
          if (onLoadingComplete) {
            (0, _warnonce.warnOnce)(`Image with src "${src}" is using deprecated "onLoadingComplete" property. Please use the "onLoad" property instead.`);
          }
          for (const [legacyKey, legacyValue] of Object.entries({
            layout,
            objectFit,
            objectPosition,
            lazyBoundary,
            lazyRoot
          })) {
            if (legacyValue) {
              (0, _warnonce.warnOnce)(`Image with src "${src}" has legacy prop "${legacyKey}". Did you forget to run the codemod?
Read more: https://nextjs.org/docs/messages/next-image-upgrade-to-13`);
            }
          }
          if (typeof window !== "undefined" && !perfObserver && window.PerformanceObserver) {
            perfObserver = new PerformanceObserver((entryList) => {
              for (const entry of entryList.getEntries()) {
                const imgSrc = entry?.element?.src || "";
                const lcpImage = allImgs.get(imgSrc);
                if (lcpImage && lcpImage.loading === "lazy" && lcpImage.placeholder === "empty" && !lcpImage.src.startsWith("data:") && !lcpImage.src.startsWith("blob:")) {
                  (0, _warnonce.warnOnce)(`Image with src "${lcpImage.src}" was detected as the Largest Contentful Paint (LCP). Please add the \`loading="eager"\` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading`);
                }
              }
            });
            try {
              perfObserver.observe({
                type: "largest-contentful-paint",
                buffered: true
              });
            } catch (err) {
              console.error(err);
            }
          }
        }
        const imgStyle = Object.assign(fill ? {
          position: "absolute",
          height: "100%",
          width: "100%",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          objectFit,
          objectPosition
        } : {}, showAltText ? {} : {
          color: "transparent"
        }, style);
        const backgroundImage = !blurComplete && placeholder !== "empty" ? placeholder === "blur" ? `url("data:image/svg+xml;charset=utf-8,${(0, _imageblursvg.getImageBlurSvg)({
          widthInt,
          heightInt,
          blurWidth,
          blurHeight,
          blurDataURL: blurDataURL || "",
          objectFit: imgStyle.objectFit
        })}")` : `url("${placeholder}")` : null;
        const backgroundSize = !INVALID_BACKGROUND_SIZE_VALUES.includes(imgStyle.objectFit) ? imgStyle.objectFit : imgStyle.objectFit === "fill" ? "100% 100%" : "cover";
        let placeholderStyle = backgroundImage ? {
          backgroundSize,
          backgroundPosition: imgStyle.objectPosition || "50% 50%",
          backgroundRepeat: "no-repeat",
          backgroundImage
        } : {};
        if (true) {
          if (placeholderStyle.backgroundImage && placeholder === "blur" && blurDataURL?.startsWith("/")) {
            placeholderStyle.backgroundImage = `url("${blurDataURL}")`;
          }
        }
        const imgAttributes = generateImgAttrs({
          config,
          src,
          unoptimized,
          width: widthInt,
          quality: qualityInt,
          sizes,
          loader
        });
        const loadingFinal = isLazy ? "lazy" : loading;
        if (true) {
          if (typeof window !== "undefined") {
            let fullUrl;
            try {
              fullUrl = new URL(imgAttributes.src);
            } catch (e) {
              fullUrl = new URL(imgAttributes.src, window.location.href);
            }
            allImgs.set(fullUrl.href, {
              src,
              loading: loadingFinal,
              placeholder
            });
          }
        }
        const props = {
          ...rest,
          loading: loadingFinal,
          fetchPriority,
          width: widthInt,
          height: heightInt,
          decoding,
          className,
          style: {
            ...imgStyle,
            ...placeholderStyle
          },
          sizes: imgAttributes.sizes,
          srcSet: imgAttributes.srcSet,
          src: overrideSrc || imgAttributes.src
        };
        const meta = {
          unoptimized,
          preload: preload || priority,
          placeholder,
          fill
        };
        return {
          props,
          meta
        };
      }
    }
  });

  // node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs
  var require_interop_require_wildcard = __commonJS({
    "node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs"(exports) {
      "use strict";
      init_define_import_meta_env();
      function _getRequireWildcardCache(nodeInterop) {
        if (typeof WeakMap !== "function") return null;
        var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
        var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
        return (_getRequireWildcardCache = function(nodeInterop2) {
          return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
        })(nodeInterop);
      }
      function _interop_require_wildcard(obj, nodeInterop) {
        if (!nodeInterop && obj && obj.__esModule) return obj;
        if (obj === null || typeof obj !== "object" && typeof obj !== "function") return { default: obj };
        var cache = _getRequireWildcardCache(nodeInterop);
        if (cache && cache.has(obj)) return cache.get(obj);
        var newObj = { __proto__: null };
        var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
        for (var key in obj) {
          if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) Object.defineProperty(newObj, key, desc);
            else newObj[key] = obj[key];
          }
        }
        newObj.default = obj;
        if (cache) cache.set(obj, newObj);
        return newObj;
      }
      exports._ = _interop_require_wildcard;
    }
  });

  // shim:react-dom-shim
  var require_react_dom_shim = __commonJS({
    "shim:react-dom-shim"(exports, module) {
      init_define_import_meta_env();
      var D = window.ReactDOM;
      var n = function() {
      };
      module.exports = Object.assign({ preload: n, preinit: n, preconnect: n, prefetchDNS: n, preloadModule: n, preinitModule: n }, D);
    }
  });

  // node_modules/next/dist/shared/lib/side-effect.js
  var require_side_effect = __commonJS({
    "node_modules/next/dist/shared/lib/side-effect.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "default", {
        enumerable: true,
        get: function() {
          return SideEffect;
        }
      });
      var _react = require_react_shim();
      var isServer = typeof window === "undefined";
      var useClientOnlyLayoutEffect = isServer ? () => {
      } : _react.useLayoutEffect;
      var useClientOnlyEffect = isServer ? () => {
      } : _react.useEffect;
      function SideEffect(props) {
        const { headManager, reduceComponentsToState } = props;
        function emitChange() {
          if (headManager && headManager.mountedInstances) {
            const headElements = _react.Children.toArray(Array.from(headManager.mountedInstances).filter(Boolean));
            headManager.updateHead(reduceComponentsToState(headElements));
          }
        }
        if (isServer) {
          headManager?.mountedInstances?.add(props.children);
          emitChange();
        }
        useClientOnlyLayoutEffect(() => {
          headManager?.mountedInstances?.add(props.children);
          return () => {
            headManager?.mountedInstances?.delete(props.children);
          };
        });
        useClientOnlyLayoutEffect(() => {
          if (headManager) {
            headManager._pendingUpdate = emitChange;
          }
          return () => {
            if (headManager) {
              headManager._pendingUpdate = emitChange;
            }
          };
        });
        useClientOnlyEffect(() => {
          if (headManager && headManager._pendingUpdate) {
            headManager._pendingUpdate();
            headManager._pendingUpdate = null;
          }
          return () => {
            if (headManager && headManager._pendingUpdate) {
              headManager._pendingUpdate();
              headManager._pendingUpdate = null;
            }
          };
        });
        return null;
      }
    }
  });

  // node_modules/next/dist/shared/lib/head-manager-context.shared-runtime.js
  var require_head_manager_context_shared_runtime = __commonJS({
    "node_modules/next/dist/shared/lib/head-manager-context.shared-runtime.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "HeadManagerContext", {
        enumerable: true,
        get: function() {
          return HeadManagerContext;
        }
      });
      var _interop_require_default = require_interop_require_default();
      var _react = /* @__PURE__ */ _interop_require_default._(require_react_shim());
      var HeadManagerContext = _react.default.createContext({});
      if (true) {
        HeadManagerContext.displayName = "HeadManagerContext";
      }
    }
  });

  // node_modules/next/dist/shared/lib/head.js
  var require_head = __commonJS({
    "node_modules/next/dist/shared/lib/head.js"(exports, module) {
      "use client";
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: all[name]
        });
      }
      _export(exports, {
        default: function() {
          return _default;
        },
        defaultHead: function() {
          return defaultHead;
        }
      });
      var _interop_require_default = require_interop_require_default();
      var _interop_require_wildcard = require_interop_require_wildcard();
      var _jsxruntime = require_react_shim();
      var _react = /* @__PURE__ */ _interop_require_wildcard._(require_react_shim());
      var _sideeffect = /* @__PURE__ */ _interop_require_default._(require_side_effect());
      var _headmanagercontextsharedruntime = require_head_manager_context_shared_runtime();
      var _warnonce = require_warn_once();
      function defaultHead() {
        const head = [
          /* @__PURE__ */ (0, _jsxruntime.jsx)("meta", {
            charSet: "utf-8"
          }, "charset"),
          /* @__PURE__ */ (0, _jsxruntime.jsx)("meta", {
            name: "viewport",
            content: "width=device-width"
          }, "viewport")
        ];
        return head;
      }
      function onlyReactElement(list, child) {
        if (typeof child === "string" || typeof child === "number") {
          return list;
        }
        if (child.type === _react.default.Fragment) {
          return list.concat(
            // @ts-expect-error @types/react does not remove fragments but this could also return ReactPortal[]
            _react.default.Children.toArray(child.props.children).reduce(
              // @ts-expect-error @types/react does not remove fragments but this could also return ReactPortal[]
              (fragmentList, fragmentChild) => {
                if (typeof fragmentChild === "string" || typeof fragmentChild === "number") {
                  return fragmentList;
                }
                return fragmentList.concat(fragmentChild);
              },
              []
            )
          );
        }
        return list.concat(child);
      }
      var METATYPES = [
        "name",
        "httpEquiv",
        "charSet",
        "itemProp"
      ];
      function unique() {
        const keys = /* @__PURE__ */ new Set();
        const tags = /* @__PURE__ */ new Set();
        const metaTypes = /* @__PURE__ */ new Set();
        const metaCategories = {};
        return (h) => {
          let isUnique = true;
          let hasKey = false;
          if (h.key && typeof h.key !== "number" && h.key.indexOf("$") > 0) {
            hasKey = true;
            const key = h.key.slice(h.key.indexOf("$") + 1);
            if (keys.has(key)) {
              isUnique = false;
            } else {
              keys.add(key);
            }
          }
          switch (h.type) {
            case "title":
            case "base":
              if (tags.has(h.type)) {
                isUnique = false;
              } else {
                tags.add(h.type);
              }
              break;
            case "meta":
              for (let i = 0, len = METATYPES.length; i < len; i++) {
                const metatype = METATYPES[i];
                if (!h.props.hasOwnProperty(metatype)) continue;
                if (metatype === "charSet") {
                  if (metaTypes.has(metatype)) {
                    isUnique = false;
                  } else {
                    metaTypes.add(metatype);
                  }
                } else {
                  const category = h.props[metatype];
                  const categories = metaCategories[metatype] || /* @__PURE__ */ new Set();
                  if ((metatype !== "name" || !hasKey) && categories.has(category)) {
                    isUnique = false;
                  } else {
                    categories.add(category);
                    metaCategories[metatype] = categories;
                  }
                }
              }
              break;
          }
          return isUnique;
        };
      }
      function reduceComponents(headChildrenElements) {
        return headChildrenElements.reduce(onlyReactElement, []).reverse().concat(defaultHead().reverse()).filter(unique()).reverse().map((c, i) => {
          const key = c.key || i;
          if (true) {
            if (c.type === "script" && c.props["type"] !== "application/ld+json") {
              const srcMessage = c.props["src"] ? `<script> tag with src="${c.props["src"]}"` : `inline <script>`;
              (0, _warnonce.warnOnce)(`Do not add <script> tags using next/head (see ${srcMessage}). Use next/script instead. 
See more info here: https://nextjs.org/docs/messages/no-script-tags-in-head-component`);
            } else if (c.type === "link" && c.props["rel"] === "stylesheet") {
              (0, _warnonce.warnOnce)(`Do not add stylesheets using next/head (see <link rel="stylesheet"> tag with href="${c.props["href"]}"). Use Document instead. 
See more info here: https://nextjs.org/docs/messages/no-stylesheets-in-head-component`);
            }
          }
          return /* @__PURE__ */ _react.default.cloneElement(c, {
            key
          });
        });
      }
      function Head({ children }) {
        const headManager = (0, _react.useContext)(_headmanagercontextsharedruntime.HeadManagerContext);
        return /* @__PURE__ */ (0, _jsxruntime.jsx)(_sideeffect.default, {
          reduceComponentsToState: reduceComponents,
          headManager,
          children
        });
      }
      var _default = Head;
      if ((typeof exports.default === "function" || typeof exports.default === "object" && exports.default !== null) && typeof exports.default.__esModule === "undefined") {
        Object.defineProperty(exports.default, "__esModule", { value: true });
        Object.assign(exports.default, exports);
        module.exports = exports.default;
      }
    }
  });

  // node_modules/next/dist/shared/lib/image-config-context.shared-runtime.js
  var require_image_config_context_shared_runtime = __commonJS({
    "node_modules/next/dist/shared/lib/image-config-context.shared-runtime.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "ImageConfigContext", {
        enumerable: true,
        get: function() {
          return ImageConfigContext;
        }
      });
      var _interop_require_default = require_interop_require_default();
      var _react = /* @__PURE__ */ _interop_require_default._(require_react_shim());
      var _imageconfig = require_image_config();
      var ImageConfigContext = _react.default.createContext(_imageconfig.imageConfigDefault);
      if (true) {
        ImageConfigContext.displayName = "ImageConfigContext";
      }
    }
  });

  // node_modules/next/dist/shared/lib/router-context.shared-runtime.js
  var require_router_context_shared_runtime = __commonJS({
    "node_modules/next/dist/shared/lib/router-context.shared-runtime.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "RouterContext", {
        enumerable: true,
        get: function() {
          return RouterContext;
        }
      });
      var _interop_require_default = require_interop_require_default();
      var _react = /* @__PURE__ */ _interop_require_default._(require_react_shim());
      var RouterContext = _react.default.createContext(null);
      if (true) {
        RouterContext.displayName = "RouterContext";
      }
    }
  });

  // node_modules/next/dist/shared/lib/find-closest-quality.js
  var require_find_closest_quality = __commonJS({
    "node_modules/next/dist/shared/lib/find-closest-quality.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "findClosestQuality", {
        enumerable: true,
        get: function() {
          return findClosestQuality;
        }
      });
      function findClosestQuality(quality, config) {
        const q = quality || 75;
        if (!config?.qualities?.length) {
          return q;
        }
        return config.qualities.reduce((prev, cur) => Math.abs(cur - q) < Math.abs(prev - q) ? cur : prev, config.qualities[0]);
      }
    }
  });

  // node_modules/next/dist/compiled/picomatch/index.js
  var require_picomatch = __commonJS({
    "node_modules/next/dist/compiled/picomatch/index.js"(exports, module) {
      init_define_import_meta_env();
      (() => {
        "use strict";
        var t = { 170: (t2, e2, u2) => {
          const n = u2(510);
          const isWindows = () => {
            if (typeof navigator !== "undefined" && navigator.platform) {
              const t3 = navigator.platform.toLowerCase();
              return t3 === "win32" || t3 === "windows";
            }
            if (typeof process !== "undefined" && process.platform) {
              return process.platform === "win32";
            }
            return false;
          };
          function picomatch(t3, e3, u3 = false) {
            if (e3 && (e3.windows === null || e3.windows === void 0)) {
              e3 = { ...e3, windows: isWindows() };
            }
            return n(t3, e3, u3);
          }
          Object.assign(picomatch, n);
          t2.exports = picomatch;
        }, 154: (t2) => {
          const e2 = "\\\\/";
          const u2 = `[^${e2}]`;
          const n = "\\.";
          const o = "\\+";
          const s = "\\?";
          const r2 = "\\/";
          const a = "(?=.)";
          const i = "[^/]";
          const c = `(?:${r2}|$)`;
          const p = `(?:^|${r2})`;
          const l = `${n}{1,2}${c}`;
          const f = `(?!${n})`;
          const A = `(?!${p}${l})`;
          const _ = `(?!${n}{0,1}${c})`;
          const R = `(?!${l})`;
          const E = `[^.${r2}]`;
          const h = `${i}*?`;
          const g = "/";
          const b = { DOT_LITERAL: n, PLUS_LITERAL: o, QMARK_LITERAL: s, SLASH_LITERAL: r2, ONE_CHAR: a, QMARK: i, END_ANCHOR: c, DOTS_SLASH: l, NO_DOT: f, NO_DOTS: A, NO_DOT_SLASH: _, NO_DOTS_SLASH: R, QMARK_NO_DOT: E, STAR: h, START_ANCHOR: p, SEP: g };
          const C = { ...b, SLASH_LITERAL: `[${e2}]`, QMARK: u2, STAR: `${u2}*?`, DOTS_SLASH: `${n}{1,2}(?:[${e2}]|$)`, NO_DOT: `(?!${n})`, NO_DOTS: `(?!(?:^|[${e2}])${n}{1,2}(?:[${e2}]|$))`, NO_DOT_SLASH: `(?!${n}{0,1}(?:[${e2}]|$))`, NO_DOTS_SLASH: `(?!${n}{1,2}(?:[${e2}]|$))`, QMARK_NO_DOT: `[^.${e2}]`, START_ANCHOR: `(?:^|[${e2}])`, END_ANCHOR: `(?:[${e2}]|$)`, SEP: "\\" };
          const y = { alnum: "a-zA-Z0-9", alpha: "a-zA-Z", ascii: "\\x00-\\x7F", blank: " \\t", cntrl: "\\x00-\\x1F\\x7F", digit: "0-9", graph: "\\x21-\\x7E", lower: "a-z", print: "\\x20-\\x7E ", punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~", space: " \\t\\r\\n\\v\\f", upper: "A-Z", word: "A-Za-z0-9_", xdigit: "A-Fa-f0-9" };
          t2.exports = { MAX_LENGTH: 1024 * 64, POSIX_REGEX_SOURCE: y, REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g, REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/, REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/, REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g, REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g, REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g, REPLACEMENTS: { "***": "*", "**/**": "**", "**/**/**": "**" }, CHAR_0: 48, CHAR_9: 57, CHAR_UPPERCASE_A: 65, CHAR_LOWERCASE_A: 97, CHAR_UPPERCASE_Z: 90, CHAR_LOWERCASE_Z: 122, CHAR_LEFT_PARENTHESES: 40, CHAR_RIGHT_PARENTHESES: 41, CHAR_ASTERISK: 42, CHAR_AMPERSAND: 38, CHAR_AT: 64, CHAR_BACKWARD_SLASH: 92, CHAR_CARRIAGE_RETURN: 13, CHAR_CIRCUMFLEX_ACCENT: 94, CHAR_COLON: 58, CHAR_COMMA: 44, CHAR_DOT: 46, CHAR_DOUBLE_QUOTE: 34, CHAR_EQUAL: 61, CHAR_EXCLAMATION_MARK: 33, CHAR_FORM_FEED: 12, CHAR_FORWARD_SLASH: 47, CHAR_GRAVE_ACCENT: 96, CHAR_HASH: 35, CHAR_HYPHEN_MINUS: 45, CHAR_LEFT_ANGLE_BRACKET: 60, CHAR_LEFT_CURLY_BRACE: 123, CHAR_LEFT_SQUARE_BRACKET: 91, CHAR_LINE_FEED: 10, CHAR_NO_BREAK_SPACE: 160, CHAR_PERCENT: 37, CHAR_PLUS: 43, CHAR_QUESTION_MARK: 63, CHAR_RIGHT_ANGLE_BRACKET: 62, CHAR_RIGHT_CURLY_BRACE: 125, CHAR_RIGHT_SQUARE_BRACKET: 93, CHAR_SEMICOLON: 59, CHAR_SINGLE_QUOTE: 39, CHAR_SPACE: 32, CHAR_TAB: 9, CHAR_UNDERSCORE: 95, CHAR_VERTICAL_LINE: 124, CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279, extglobChars(t3) {
            return { "!": { type: "negate", open: "(?:(?!(?:", close: `))${t3.STAR})` }, "?": { type: "qmark", open: "(?:", close: ")?" }, "+": { type: "plus", open: "(?:", close: ")+" }, "*": { type: "star", open: "(?:", close: ")*" }, "@": { type: "at", open: "(?:", close: ")" } };
          }, globChars(t3) {
            return t3 === true ? C : b;
          } };
        }, 697: (t2, e2, u2) => {
          const n = u2(154);
          const o = u2(96);
          const { MAX_LENGTH: s, POSIX_REGEX_SOURCE: r2, REGEX_NON_SPECIAL_CHARS: a, REGEX_SPECIAL_CHARS_BACKREF: i, REPLACEMENTS: c } = n;
          const expandRange = (t3, e3) => {
            if (typeof e3.expandRange === "function") {
              return e3.expandRange(...t3, e3);
            }
            t3.sort();
            const u3 = `[${t3.join("-")}]`;
            try {
              new RegExp(u3);
            } catch (e4) {
              return t3.map(((t4) => o.escapeRegex(t4))).join("..");
            }
            return u3;
          };
          const syntaxError = (t3, e3) => `Missing ${t3}: "${e3}" - use "\\\\${e3}" to match literal characters`;
          const parse = (t3, e3) => {
            if (typeof t3 !== "string") {
              throw new TypeError("Expected a string");
            }
            t3 = c[t3] || t3;
            const u3 = { ...e3 };
            const p = typeof u3.maxLength === "number" ? Math.min(s, u3.maxLength) : s;
            let l = t3.length;
            if (l > p) {
              throw new SyntaxError(`Input length: ${l}, exceeds maximum allowed length: ${p}`);
            }
            const f = { type: "bos", value: "", output: u3.prepend || "" };
            const A = [f];
            const _ = u3.capture ? "" : "?:";
            const R = n.globChars(u3.windows);
            const E = n.extglobChars(R);
            const { DOT_LITERAL: h, PLUS_LITERAL: g, SLASH_LITERAL: b, ONE_CHAR: C, DOTS_SLASH: y, NO_DOT: $, NO_DOT_SLASH: x, NO_DOTS_SLASH: S, QMARK: H, QMARK_NO_DOT: v, STAR: d, START_ANCHOR: L } = R;
            const globstar = (t4) => `(${_}(?:(?!${L}${t4.dot ? y : h}).)*?)`;
            const T = u3.dot ? "" : $;
            const O = u3.dot ? H : v;
            let k = u3.bash === true ? globstar(u3) : d;
            if (u3.capture) {
              k = `(${k})`;
            }
            if (typeof u3.noext === "boolean") {
              u3.noextglob = u3.noext;
            }
            const m = { input: t3, index: -1, start: 0, dot: u3.dot === true, consumed: "", output: "", prefix: "", backtrack: false, negated: false, brackets: 0, braces: 0, parens: 0, quotes: 0, globstar: false, tokens: A };
            t3 = o.removePrefix(t3, m);
            l = t3.length;
            const w = [];
            const N = [];
            const I = [];
            let B = f;
            let G;
            const eos = () => m.index === l - 1;
            const D = m.peek = (e4 = 1) => t3[m.index + e4];
            const M = m.advance = () => t3[++m.index] || "";
            const remaining = () => t3.slice(m.index + 1);
            const consume = (t4 = "", e4 = 0) => {
              m.consumed += t4;
              m.index += e4;
            };
            const append = (t4) => {
              m.output += t4.output != null ? t4.output : t4.value;
              consume(t4.value);
            };
            const negate = () => {
              let t4 = 1;
              while (D() === "!" && (D(2) !== "(" || D(3) === "?")) {
                M();
                m.start++;
                t4++;
              }
              if (t4 % 2 === 0) {
                return false;
              }
              m.negated = true;
              m.start++;
              return true;
            };
            const increment = (t4) => {
              m[t4]++;
              I.push(t4);
            };
            const decrement = (t4) => {
              m[t4]--;
              I.pop();
            };
            const push = (t4) => {
              if (B.type === "globstar") {
                const e4 = m.braces > 0 && (t4.type === "comma" || t4.type === "brace");
                const u4 = t4.extglob === true || w.length && (t4.type === "pipe" || t4.type === "paren");
                if (t4.type !== "slash" && t4.type !== "paren" && !e4 && !u4) {
                  m.output = m.output.slice(0, -B.output.length);
                  B.type = "star";
                  B.value = "*";
                  B.output = k;
                  m.output += B.output;
                }
              }
              if (w.length && t4.type !== "paren") {
                w[w.length - 1].inner += t4.value;
              }
              if (t4.value || t4.output) append(t4);
              if (B && B.type === "text" && t4.type === "text") {
                B.output = (B.output || B.value) + t4.value;
                B.value += t4.value;
                return;
              }
              t4.prev = B;
              A.push(t4);
              B = t4;
            };
            const extglobOpen = (t4, e4) => {
              const n2 = { ...E[e4], conditions: 1, inner: "" };
              n2.prev = B;
              n2.parens = m.parens;
              n2.output = m.output;
              const o2 = (u3.capture ? "(" : "") + n2.open;
              increment("parens");
              push({ type: t4, value: e4, output: m.output ? "" : C });
              push({ type: "paren", extglob: true, value: M(), output: o2 });
              w.push(n2);
            };
            const extglobClose = (t4) => {
              let n2 = t4.close + (u3.capture ? ")" : "");
              let o2;
              if (t4.type === "negate") {
                let s2 = k;
                if (t4.inner && t4.inner.length > 1 && t4.inner.includes("/")) {
                  s2 = globstar(u3);
                }
                if (s2 !== k || eos() || /^\)+$/.test(remaining())) {
                  n2 = t4.close = `)$))${s2}`;
                }
                if (t4.inner.includes("*") && (o2 = remaining()) && /^\.[^\\/.]+$/.test(o2)) {
                  const u4 = parse(o2, { ...e3, fastpaths: false }).output;
                  n2 = t4.close = `)${u4})${s2})`;
                }
                if (t4.prev.type === "bos") {
                  m.negatedExtglob = true;
                }
              }
              push({ type: "paren", extglob: true, value: G, output: n2 });
              decrement("parens");
            };
            if (u3.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(t3)) {
              let n2 = false;
              let s2 = t3.replace(i, ((t4, e4, u4, o2, s3, r3) => {
                if (o2 === "\\") {
                  n2 = true;
                  return t4;
                }
                if (o2 === "?") {
                  if (e4) {
                    return e4 + o2 + (s3 ? H.repeat(s3.length) : "");
                  }
                  if (r3 === 0) {
                    return O + (s3 ? H.repeat(s3.length) : "");
                  }
                  return H.repeat(u4.length);
                }
                if (o2 === ".") {
                  return h.repeat(u4.length);
                }
                if (o2 === "*") {
                  if (e4) {
                    return e4 + o2 + (s3 ? k : "");
                  }
                  return k;
                }
                return e4 ? t4 : `\\${t4}`;
              }));
              if (n2 === true) {
                if (u3.unescape === true) {
                  s2 = s2.replace(/\\/g, "");
                } else {
                  s2 = s2.replace(/\\+/g, ((t4) => t4.length % 2 === 0 ? "\\\\" : t4 ? "\\" : ""));
                }
              }
              if (s2 === t3 && u3.contains === true) {
                m.output = t3;
                return m;
              }
              m.output = o.wrapOutput(s2, m, e3);
              return m;
            }
            while (!eos()) {
              G = M();
              if (G === "\0") {
                continue;
              }
              if (G === "\\") {
                const t4 = D();
                if (t4 === "/" && u3.bash !== true) {
                  continue;
                }
                if (t4 === "." || t4 === ";") {
                  continue;
                }
                if (!t4) {
                  G += "\\";
                  push({ type: "text", value: G });
                  continue;
                }
                const e5 = /^\\+/.exec(remaining());
                let n3 = 0;
                if (e5 && e5[0].length > 2) {
                  n3 = e5[0].length;
                  m.index += n3;
                  if (n3 % 2 !== 0) {
                    G += "\\";
                  }
                }
                if (u3.unescape === true) {
                  G = M();
                } else {
                  G += M();
                }
                if (m.brackets === 0) {
                  push({ type: "text", value: G });
                  continue;
                }
              }
              if (m.brackets > 0 && (G !== "]" || B.value === "[" || B.value === "[^")) {
                if (u3.posix !== false && G === ":") {
                  const t4 = B.value.slice(1);
                  if (t4.includes("[")) {
                    B.posix = true;
                    if (t4.includes(":")) {
                      const t5 = B.value.lastIndexOf("[");
                      const e5 = B.value.slice(0, t5);
                      const u4 = B.value.slice(t5 + 2);
                      const n3 = r2[u4];
                      if (n3) {
                        B.value = e5 + n3;
                        m.backtrack = true;
                        M();
                        if (!f.output && A.indexOf(B) === 1) {
                          f.output = C;
                        }
                        continue;
                      }
                    }
                  }
                }
                if (G === "[" && D() !== ":" || G === "-" && D() === "]") {
                  G = `\\${G}`;
                }
                if (G === "]" && (B.value === "[" || B.value === "[^")) {
                  G = `\\${G}`;
                }
                if (u3.posix === true && G === "!" && B.value === "[") {
                  G = "^";
                }
                B.value += G;
                append({ value: G });
                continue;
              }
              if (m.quotes === 1 && G !== '"') {
                G = o.escapeRegex(G);
                B.value += G;
                append({ value: G });
                continue;
              }
              if (G === '"') {
                m.quotes = m.quotes === 1 ? 0 : 1;
                if (u3.keepQuotes === true) {
                  push({ type: "text", value: G });
                }
                continue;
              }
              if (G === "(") {
                increment("parens");
                push({ type: "paren", value: G });
                continue;
              }
              if (G === ")") {
                if (m.parens === 0 && u3.strictBrackets === true) {
                  throw new SyntaxError(syntaxError("opening", "("));
                }
                const t4 = w[w.length - 1];
                if (t4 && m.parens === t4.parens + 1) {
                  extglobClose(w.pop());
                  continue;
                }
                push({ type: "paren", value: G, output: m.parens ? ")" : "\\)" });
                decrement("parens");
                continue;
              }
              if (G === "[") {
                if (u3.nobracket === true || !remaining().includes("]")) {
                  if (u3.nobracket !== true && u3.strictBrackets === true) {
                    throw new SyntaxError(syntaxError("closing", "]"));
                  }
                  G = `\\${G}`;
                } else {
                  increment("brackets");
                }
                push({ type: "bracket", value: G });
                continue;
              }
              if (G === "]") {
                if (u3.nobracket === true || B && B.type === "bracket" && B.value.length === 1) {
                  push({ type: "text", value: G, output: `\\${G}` });
                  continue;
                }
                if (m.brackets === 0) {
                  if (u3.strictBrackets === true) {
                    throw new SyntaxError(syntaxError("opening", "["));
                  }
                  push({ type: "text", value: G, output: `\\${G}` });
                  continue;
                }
                decrement("brackets");
                const t4 = B.value.slice(1);
                if (B.posix !== true && t4[0] === "^" && !t4.includes("/")) {
                  G = `/${G}`;
                }
                B.value += G;
                append({ value: G });
                if (u3.literalBrackets === false || o.hasRegexChars(t4)) {
                  continue;
                }
                const e5 = o.escapeRegex(B.value);
                m.output = m.output.slice(0, -B.value.length);
                if (u3.literalBrackets === true) {
                  m.output += e5;
                  B.value = e5;
                  continue;
                }
                B.value = `(${_}${e5}|${B.value})`;
                m.output += B.value;
                continue;
              }
              if (G === "{" && u3.nobrace !== true) {
                increment("braces");
                const t4 = { type: "brace", value: G, output: "(", outputIndex: m.output.length, tokensIndex: m.tokens.length };
                N.push(t4);
                push(t4);
                continue;
              }
              if (G === "}") {
                const t4 = N[N.length - 1];
                if (u3.nobrace === true || !t4) {
                  push({ type: "text", value: G, output: G });
                  continue;
                }
                let e5 = ")";
                if (t4.dots === true) {
                  const t5 = A.slice();
                  const n3 = [];
                  for (let e6 = t5.length - 1; e6 >= 0; e6--) {
                    A.pop();
                    if (t5[e6].type === "brace") {
                      break;
                    }
                    if (t5[e6].type !== "dots") {
                      n3.unshift(t5[e6].value);
                    }
                  }
                  e5 = expandRange(n3, u3);
                  m.backtrack = true;
                }
                if (t4.comma !== true && t4.dots !== true) {
                  const u4 = m.output.slice(0, t4.outputIndex);
                  const n3 = m.tokens.slice(t4.tokensIndex);
                  t4.value = t4.output = "\\{";
                  G = e5 = "\\}";
                  m.output = u4;
                  for (const t5 of n3) {
                    m.output += t5.output || t5.value;
                  }
                }
                push({ type: "brace", value: G, output: e5 });
                decrement("braces");
                N.pop();
                continue;
              }
              if (G === "|") {
                if (w.length > 0) {
                  w[w.length - 1].conditions++;
                }
                push({ type: "text", value: G });
                continue;
              }
              if (G === ",") {
                let t4 = G;
                const e5 = N[N.length - 1];
                if (e5 && I[I.length - 1] === "braces") {
                  e5.comma = true;
                  t4 = "|";
                }
                push({ type: "comma", value: G, output: t4 });
                continue;
              }
              if (G === "/") {
                if (B.type === "dot" && m.index === m.start + 1) {
                  m.start = m.index + 1;
                  m.consumed = "";
                  m.output = "";
                  A.pop();
                  B = f;
                  continue;
                }
                push({ type: "slash", value: G, output: b });
                continue;
              }
              if (G === ".") {
                if (m.braces > 0 && B.type === "dot") {
                  if (B.value === ".") B.output = h;
                  const t4 = N[N.length - 1];
                  B.type = "dots";
                  B.output += G;
                  B.value += G;
                  t4.dots = true;
                  continue;
                }
                if (m.braces + m.parens === 0 && B.type !== "bos" && B.type !== "slash") {
                  push({ type: "text", value: G, output: h });
                  continue;
                }
                push({ type: "dot", value: G, output: h });
                continue;
              }
              if (G === "?") {
                const t4 = B && B.value === "(";
                if (!t4 && u3.noextglob !== true && D() === "(" && D(2) !== "?") {
                  extglobOpen("qmark", G);
                  continue;
                }
                if (B && B.type === "paren") {
                  const t5 = D();
                  let e5 = G;
                  if (B.value === "(" && !/[!=<:]/.test(t5) || t5 === "<" && !/<([!=]|\w+>)/.test(remaining())) {
                    e5 = `\\${G}`;
                  }
                  push({ type: "text", value: G, output: e5 });
                  continue;
                }
                if (u3.dot !== true && (B.type === "slash" || B.type === "bos")) {
                  push({ type: "qmark", value: G, output: v });
                  continue;
                }
                push({ type: "qmark", value: G, output: H });
                continue;
              }
              if (G === "!") {
                if (u3.noextglob !== true && D() === "(") {
                  if (D(2) !== "?" || !/[!=<:]/.test(D(3))) {
                    extglobOpen("negate", G);
                    continue;
                  }
                }
                if (u3.nonegate !== true && m.index === 0) {
                  negate();
                  continue;
                }
              }
              if (G === "+") {
                if (u3.noextglob !== true && D() === "(" && D(2) !== "?") {
                  extglobOpen("plus", G);
                  continue;
                }
                if (B && B.value === "(" || u3.regex === false) {
                  push({ type: "plus", value: G, output: g });
                  continue;
                }
                if (B && (B.type === "bracket" || B.type === "paren" || B.type === "brace") || m.parens > 0) {
                  push({ type: "plus", value: G });
                  continue;
                }
                push({ type: "plus", value: g });
                continue;
              }
              if (G === "@") {
                if (u3.noextglob !== true && D() === "(" && D(2) !== "?") {
                  push({ type: "at", extglob: true, value: G, output: "" });
                  continue;
                }
                push({ type: "text", value: G });
                continue;
              }
              if (G !== "*") {
                if (G === "$" || G === "^") {
                  G = `\\${G}`;
                }
                const t4 = a.exec(remaining());
                if (t4) {
                  G += t4[0];
                  m.index += t4[0].length;
                }
                push({ type: "text", value: G });
                continue;
              }
              if (B && (B.type === "globstar" || B.star === true)) {
                B.type = "star";
                B.star = true;
                B.value += G;
                B.output = k;
                m.backtrack = true;
                m.globstar = true;
                consume(G);
                continue;
              }
              let e4 = remaining();
              if (u3.noextglob !== true && /^\([^?]/.test(e4)) {
                extglobOpen("star", G);
                continue;
              }
              if (B.type === "star") {
                if (u3.noglobstar === true) {
                  consume(G);
                  continue;
                }
                const n3 = B.prev;
                const o2 = n3.prev;
                const s2 = n3.type === "slash" || n3.type === "bos";
                const r3 = o2 && (o2.type === "star" || o2.type === "globstar");
                if (u3.bash === true && (!s2 || e4[0] && e4[0] !== "/")) {
                  push({ type: "star", value: G, output: "" });
                  continue;
                }
                const a2 = m.braces > 0 && (n3.type === "comma" || n3.type === "brace");
                const i2 = w.length && (n3.type === "pipe" || n3.type === "paren");
                if (!s2 && n3.type !== "paren" && !a2 && !i2) {
                  push({ type: "star", value: G, output: "" });
                  continue;
                }
                while (e4.slice(0, 3) === "/**") {
                  const u4 = t3[m.index + 4];
                  if (u4 && u4 !== "/") {
                    break;
                  }
                  e4 = e4.slice(3);
                  consume("/**", 3);
                }
                if (n3.type === "bos" && eos()) {
                  B.type = "globstar";
                  B.value += G;
                  B.output = globstar(u3);
                  m.output = B.output;
                  m.globstar = true;
                  consume(G);
                  continue;
                }
                if (n3.type === "slash" && n3.prev.type !== "bos" && !r3 && eos()) {
                  m.output = m.output.slice(0, -(n3.output + B.output).length);
                  n3.output = `(?:${n3.output}`;
                  B.type = "globstar";
                  B.output = globstar(u3) + (u3.strictSlashes ? ")" : "|$)");
                  B.value += G;
                  m.globstar = true;
                  m.output += n3.output + B.output;
                  consume(G);
                  continue;
                }
                if (n3.type === "slash" && n3.prev.type !== "bos" && e4[0] === "/") {
                  const t4 = e4[1] !== void 0 ? "|$" : "";
                  m.output = m.output.slice(0, -(n3.output + B.output).length);
                  n3.output = `(?:${n3.output}`;
                  B.type = "globstar";
                  B.output = `${globstar(u3)}${b}|${b}${t4})`;
                  B.value += G;
                  m.output += n3.output + B.output;
                  m.globstar = true;
                  consume(G + M());
                  push({ type: "slash", value: "/", output: "" });
                  continue;
                }
                if (n3.type === "bos" && e4[0] === "/") {
                  B.type = "globstar";
                  B.value += G;
                  B.output = `(?:^|${b}|${globstar(u3)}${b})`;
                  m.output = B.output;
                  m.globstar = true;
                  consume(G + M());
                  push({ type: "slash", value: "/", output: "" });
                  continue;
                }
                m.output = m.output.slice(0, -B.output.length);
                B.type = "globstar";
                B.output = globstar(u3);
                B.value += G;
                m.output += B.output;
                m.globstar = true;
                consume(G);
                continue;
              }
              const n2 = { type: "star", value: G, output: k };
              if (u3.bash === true) {
                n2.output = ".*?";
                if (B.type === "bos" || B.type === "slash") {
                  n2.output = T + n2.output;
                }
                push(n2);
                continue;
              }
              if (B && (B.type === "bracket" || B.type === "paren") && u3.regex === true) {
                n2.output = G;
                push(n2);
                continue;
              }
              if (m.index === m.start || B.type === "slash" || B.type === "dot") {
                if (B.type === "dot") {
                  m.output += x;
                  B.output += x;
                } else if (u3.dot === true) {
                  m.output += S;
                  B.output += S;
                } else {
                  m.output += T;
                  B.output += T;
                }
                if (D() !== "*") {
                  m.output += C;
                  B.output += C;
                }
              }
              push(n2);
            }
            while (m.brackets > 0) {
              if (u3.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
              m.output = o.escapeLast(m.output, "[");
              decrement("brackets");
            }
            while (m.parens > 0) {
              if (u3.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
              m.output = o.escapeLast(m.output, "(");
              decrement("parens");
            }
            while (m.braces > 0) {
              if (u3.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
              m.output = o.escapeLast(m.output, "{");
              decrement("braces");
            }
            if (u3.strictSlashes !== true && (B.type === "star" || B.type === "bracket")) {
              push({ type: "maybe_slash", value: "", output: `${b}?` });
            }
            if (m.backtrack === true) {
              m.output = "";
              for (const t4 of m.tokens) {
                m.output += t4.output != null ? t4.output : t4.value;
                if (t4.suffix) {
                  m.output += t4.suffix;
                }
              }
            }
            return m;
          };
          parse.fastpaths = (t3, e3) => {
            const u3 = { ...e3 };
            const r3 = typeof u3.maxLength === "number" ? Math.min(s, u3.maxLength) : s;
            const a2 = t3.length;
            if (a2 > r3) {
              throw new SyntaxError(`Input length: ${a2}, exceeds maximum allowed length: ${r3}`);
            }
            t3 = c[t3] || t3;
            const { DOT_LITERAL: i2, SLASH_LITERAL: p, ONE_CHAR: l, DOTS_SLASH: f, NO_DOT: A, NO_DOTS: _, NO_DOTS_SLASH: R, STAR: E, START_ANCHOR: h } = n.globChars(u3.windows);
            const g = u3.dot ? _ : A;
            const b = u3.dot ? R : A;
            const C = u3.capture ? "" : "?:";
            const y = { negated: false, prefix: "" };
            let $ = u3.bash === true ? ".*?" : E;
            if (u3.capture) {
              $ = `(${$})`;
            }
            const globstar = (t4) => {
              if (t4.noglobstar === true) return $;
              return `(${C}(?:(?!${h}${t4.dot ? f : i2}).)*?)`;
            };
            const create = (t4) => {
              switch (t4) {
                case "*":
                  return `${g}${l}${$}`;
                case ".*":
                  return `${i2}${l}${$}`;
                case "*.*":
                  return `${g}${$}${i2}${l}${$}`;
                case "*/*":
                  return `${g}${$}${p}${l}${b}${$}`;
                case "**":
                  return g + globstar(u3);
                case "**/*":
                  return `(?:${g}${globstar(u3)}${p})?${b}${l}${$}`;
                case "**/*.*":
                  return `(?:${g}${globstar(u3)}${p})?${b}${$}${i2}${l}${$}`;
                case "**/.*":
                  return `(?:${g}${globstar(u3)}${p})?${i2}${l}${$}`;
                default: {
                  const e4 = /^(.*?)\.(\w+)$/.exec(t4);
                  if (!e4) return;
                  const u4 = create(e4[1]);
                  if (!u4) return;
                  return u4 + i2 + e4[2];
                }
              }
            };
            const x = o.removePrefix(t3, y);
            let S = create(x);
            if (S && u3.strictSlashes !== true) {
              S += `${p}?`;
            }
            return S;
          };
          t2.exports = parse;
        }, 510: (t2, e2, u2) => {
          const n = u2(716);
          const o = u2(697);
          const s = u2(96);
          const r2 = u2(154);
          const isObject = (t3) => t3 && typeof t3 === "object" && !Array.isArray(t3);
          const picomatch = (t3, e3, u3 = false) => {
            if (Array.isArray(t3)) {
              const n3 = t3.map(((t4) => picomatch(t4, e3, u3)));
              const arrayMatcher = (t4) => {
                for (const e4 of n3) {
                  const u4 = e4(t4);
                  if (u4) return u4;
                }
                return false;
              };
              return arrayMatcher;
            }
            const n2 = isObject(t3) && t3.tokens && t3.input;
            if (t3 === "" || typeof t3 !== "string" && !n2) {
              throw new TypeError("Expected pattern to be a non-empty string");
            }
            const o2 = e3 || {};
            const s2 = o2.windows;
            const r3 = n2 ? picomatch.compileRe(t3, e3) : picomatch.makeRe(t3, e3, false, true);
            const a = r3.state;
            delete r3.state;
            let isIgnored = () => false;
            if (o2.ignore) {
              const t4 = { ...e3, ignore: null, onMatch: null, onResult: null };
              isIgnored = picomatch(o2.ignore, t4, u3);
            }
            const matcher = (u4, n3 = false) => {
              const { isMatch: i, match: c, output: p } = picomatch.test(u4, r3, e3, { glob: t3, posix: s2 });
              const l = { glob: t3, state: a, regex: r3, posix: s2, input: u4, output: p, match: c, isMatch: i };
              if (typeof o2.onResult === "function") {
                o2.onResult(l);
              }
              if (i === false) {
                l.isMatch = false;
                return n3 ? l : false;
              }
              if (isIgnored(u4)) {
                if (typeof o2.onIgnore === "function") {
                  o2.onIgnore(l);
                }
                l.isMatch = false;
                return n3 ? l : false;
              }
              if (typeof o2.onMatch === "function") {
                o2.onMatch(l);
              }
              return n3 ? l : true;
            };
            if (u3) {
              matcher.state = a;
            }
            return matcher;
          };
          picomatch.test = (t3, e3, u3, { glob: n2, posix: o2 } = {}) => {
            if (typeof t3 !== "string") {
              throw new TypeError("Expected input to be a string");
            }
            if (t3 === "") {
              return { isMatch: false, output: "" };
            }
            const r3 = u3 || {};
            const a = r3.format || (o2 ? s.toPosixSlashes : null);
            let i = t3 === n2;
            let c = i && a ? a(t3) : t3;
            if (i === false) {
              c = a ? a(t3) : t3;
              i = c === n2;
            }
            if (i === false || r3.capture === true) {
              if (r3.matchBase === true || r3.basename === true) {
                i = picomatch.matchBase(t3, e3, u3, o2);
              } else {
                i = e3.exec(c);
              }
            }
            return { isMatch: Boolean(i), match: i, output: c };
          };
          picomatch.matchBase = (t3, e3, u3) => {
            const n2 = e3 instanceof RegExp ? e3 : picomatch.makeRe(e3, u3);
            return n2.test(s.basename(t3));
          };
          picomatch.isMatch = (t3, e3, u3) => picomatch(e3, u3)(t3);
          picomatch.parse = (t3, e3) => {
            if (Array.isArray(t3)) return t3.map(((t4) => picomatch.parse(t4, e3)));
            return o(t3, { ...e3, fastpaths: false });
          };
          picomatch.scan = (t3, e3) => n(t3, e3);
          picomatch.compileRe = (t3, e3, u3 = false, n2 = false) => {
            if (u3 === true) {
              return t3.output;
            }
            const o2 = e3 || {};
            const s2 = o2.contains ? "" : "^";
            const r3 = o2.contains ? "" : "$";
            let a = `${s2}(?:${t3.output})${r3}`;
            if (t3 && t3.negated === true) {
              a = `^(?!${a}).*$`;
            }
            const i = picomatch.toRegex(a, e3);
            if (n2 === true) {
              i.state = t3;
            }
            return i;
          };
          picomatch.makeRe = (t3, e3 = {}, u3 = false, n2 = false) => {
            if (!t3 || typeof t3 !== "string") {
              throw new TypeError("Expected a non-empty string");
            }
            let s2 = { negated: false, fastpaths: true };
            if (e3.fastpaths !== false && (t3[0] === "." || t3[0] === "*")) {
              s2.output = o.fastpaths(t3, e3);
            }
            if (!s2.output) {
              s2 = o(t3, e3);
            }
            return picomatch.compileRe(s2, e3, u3, n2);
          };
          picomatch.toRegex = (t3, e3) => {
            try {
              const u3 = e3 || {};
              return new RegExp(t3, u3.flags || (u3.nocase ? "i" : ""));
            } catch (t4) {
              if (e3 && e3.debug === true) throw t4;
              return /$^/;
            }
          };
          picomatch.constants = r2;
          t2.exports = picomatch;
        }, 716: (t2, e2, u2) => {
          const n = u2(96);
          const { CHAR_ASTERISK: o, CHAR_AT: s, CHAR_BACKWARD_SLASH: r2, CHAR_COMMA: a, CHAR_DOT: i, CHAR_EXCLAMATION_MARK: c, CHAR_FORWARD_SLASH: p, CHAR_LEFT_CURLY_BRACE: l, CHAR_LEFT_PARENTHESES: f, CHAR_LEFT_SQUARE_BRACKET: A, CHAR_PLUS: _, CHAR_QUESTION_MARK: R, CHAR_RIGHT_CURLY_BRACE: E, CHAR_RIGHT_PARENTHESES: h, CHAR_RIGHT_SQUARE_BRACKET: g } = u2(154);
          const isPathSeparator = (t3) => t3 === p || t3 === r2;
          const depth = (t3) => {
            if (t3.isPrefix !== true) {
              t3.depth = t3.isGlobstar ? Infinity : 1;
            }
          };
          const scan = (t3, e3) => {
            const u3 = e3 || {};
            const b = t3.length - 1;
            const C = u3.parts === true || u3.scanToEnd === true;
            const y = [];
            const $ = [];
            const x = [];
            let S = t3;
            let H = -1;
            let v = 0;
            let d = 0;
            let L = false;
            let T = false;
            let O = false;
            let k = false;
            let m = false;
            let w = false;
            let N = false;
            let I = false;
            let B = false;
            let G = false;
            let D = 0;
            let M;
            let P;
            let K = { value: "", depth: 0, isGlob: false };
            const eos = () => H >= b;
            const peek = () => S.charCodeAt(H + 1);
            const advance = () => {
              M = P;
              return S.charCodeAt(++H);
            };
            while (H < b) {
              P = advance();
              let t4;
              if (P === r2) {
                N = K.backslashes = true;
                P = advance();
                if (P === l) {
                  w = true;
                }
                continue;
              }
              if (w === true || P === l) {
                D++;
                while (eos() !== true && (P = advance())) {
                  if (P === r2) {
                    N = K.backslashes = true;
                    advance();
                    continue;
                  }
                  if (P === l) {
                    D++;
                    continue;
                  }
                  if (w !== true && P === i && (P = advance()) === i) {
                    L = K.isBrace = true;
                    O = K.isGlob = true;
                    G = true;
                    if (C === true) {
                      continue;
                    }
                    break;
                  }
                  if (w !== true && P === a) {
                    L = K.isBrace = true;
                    O = K.isGlob = true;
                    G = true;
                    if (C === true) {
                      continue;
                    }
                    break;
                  }
                  if (P === E) {
                    D--;
                    if (D === 0) {
                      w = false;
                      L = K.isBrace = true;
                      G = true;
                      break;
                    }
                  }
                }
                if (C === true) {
                  continue;
                }
                break;
              }
              if (P === p) {
                y.push(H);
                $.push(K);
                K = { value: "", depth: 0, isGlob: false };
                if (G === true) continue;
                if (M === i && H === v + 1) {
                  v += 2;
                  continue;
                }
                d = H + 1;
                continue;
              }
              if (u3.noext !== true) {
                const t5 = P === _ || P === s || P === o || P === R || P === c;
                if (t5 === true && peek() === f) {
                  O = K.isGlob = true;
                  k = K.isExtglob = true;
                  G = true;
                  if (P === c && H === v) {
                    B = true;
                  }
                  if (C === true) {
                    while (eos() !== true && (P = advance())) {
                      if (P === r2) {
                        N = K.backslashes = true;
                        P = advance();
                        continue;
                      }
                      if (P === h) {
                        O = K.isGlob = true;
                        G = true;
                        break;
                      }
                    }
                    continue;
                  }
                  break;
                }
              }
              if (P === o) {
                if (M === o) m = K.isGlobstar = true;
                O = K.isGlob = true;
                G = true;
                if (C === true) {
                  continue;
                }
                break;
              }
              if (P === R) {
                O = K.isGlob = true;
                G = true;
                if (C === true) {
                  continue;
                }
                break;
              }
              if (P === A) {
                while (eos() !== true && (t4 = advance())) {
                  if (t4 === r2) {
                    N = K.backslashes = true;
                    advance();
                    continue;
                  }
                  if (t4 === g) {
                    T = K.isBracket = true;
                    O = K.isGlob = true;
                    G = true;
                    break;
                  }
                }
                if (C === true) {
                  continue;
                }
                break;
              }
              if (u3.nonegate !== true && P === c && H === v) {
                I = K.negated = true;
                v++;
                continue;
              }
              if (u3.noparen !== true && P === f) {
                O = K.isGlob = true;
                if (C === true) {
                  while (eos() !== true && (P = advance())) {
                    if (P === f) {
                      N = K.backslashes = true;
                      P = advance();
                      continue;
                    }
                    if (P === h) {
                      G = true;
                      break;
                    }
                  }
                  continue;
                }
                break;
              }
              if (O === true) {
                G = true;
                if (C === true) {
                  continue;
                }
                break;
              }
            }
            if (u3.noext === true) {
              k = false;
              O = false;
            }
            let U = S;
            let X = "";
            let F = "";
            if (v > 0) {
              X = S.slice(0, v);
              S = S.slice(v);
              d -= v;
            }
            if (U && O === true && d > 0) {
              U = S.slice(0, d);
              F = S.slice(d);
            } else if (O === true) {
              U = "";
              F = S;
            } else {
              U = S;
            }
            if (U && U !== "" && U !== "/" && U !== S) {
              if (isPathSeparator(U.charCodeAt(U.length - 1))) {
                U = U.slice(0, -1);
              }
            }
            if (u3.unescape === true) {
              if (F) F = n.removeBackslashes(F);
              if (U && N === true) {
                U = n.removeBackslashes(U);
              }
            }
            const Q = { prefix: X, input: t3, start: v, base: U, glob: F, isBrace: L, isBracket: T, isGlob: O, isExtglob: k, isGlobstar: m, negated: I, negatedExtglob: B };
            if (u3.tokens === true) {
              Q.maxDepth = 0;
              if (!isPathSeparator(P)) {
                $.push(K);
              }
              Q.tokens = $;
            }
            if (u3.parts === true || u3.tokens === true) {
              let e4;
              for (let n2 = 0; n2 < y.length; n2++) {
                const o2 = e4 ? e4 + 1 : v;
                const s2 = y[n2];
                const r3 = t3.slice(o2, s2);
                if (u3.tokens) {
                  if (n2 === 0 && v !== 0) {
                    $[n2].isPrefix = true;
                    $[n2].value = X;
                  } else {
                    $[n2].value = r3;
                  }
                  depth($[n2]);
                  Q.maxDepth += $[n2].depth;
                }
                if (n2 !== 0 || r3 !== "") {
                  x.push(r3);
                }
                e4 = s2;
              }
              if (e4 && e4 + 1 < t3.length) {
                const n2 = t3.slice(e4 + 1);
                x.push(n2);
                if (u3.tokens) {
                  $[$.length - 1].value = n2;
                  depth($[$.length - 1]);
                  Q.maxDepth += $[$.length - 1].depth;
                }
              }
              Q.slashes = y;
              Q.parts = x;
            }
            return Q;
          };
          t2.exports = scan;
        }, 96: (t2, e2, u2) => {
          const { REGEX_BACKSLASH: n, REGEX_REMOVE_BACKSLASH: o, REGEX_SPECIAL_CHARS: s, REGEX_SPECIAL_CHARS_GLOBAL: r2 } = u2(154);
          e2.isObject = (t3) => t3 !== null && typeof t3 === "object" && !Array.isArray(t3);
          e2.hasRegexChars = (t3) => s.test(t3);
          e2.isRegexChar = (t3) => t3.length === 1 && e2.hasRegexChars(t3);
          e2.escapeRegex = (t3) => t3.replace(r2, "\\$1");
          e2.toPosixSlashes = (t3) => t3.replace(n, "/");
          e2.removeBackslashes = (t3) => t3.replace(o, ((t4) => t4 === "\\" ? "" : t4));
          e2.escapeLast = (t3, u3, n2) => {
            const o2 = t3.lastIndexOf(u3, n2);
            if (o2 === -1) return t3;
            if (t3[o2 - 1] === "\\") return e2.escapeLast(t3, u3, o2 - 1);
            return `${t3.slice(0, o2)}\\${t3.slice(o2)}`;
          };
          e2.removePrefix = (t3, e3 = {}) => {
            let u3 = t3;
            if (u3.startsWith("./")) {
              u3 = u3.slice(2);
              e3.prefix = "./";
            }
            return u3;
          };
          e2.wrapOutput = (t3, e3 = {}, u3 = {}) => {
            const n2 = u3.contains ? "" : "^";
            const o2 = u3.contains ? "" : "$";
            let s2 = `${n2}(?:${t3})${o2}`;
            if (e3.negated === true) {
              s2 = `(?:^(?!${s2}).*$)`;
            }
            return s2;
          };
          e2.basename = (t3, { windows: e3 } = {}) => {
            const u3 = t3.split(e3 ? /[\\/]/ : "/");
            const n2 = u3[u3.length - 1];
            if (n2 === "") {
              return u3[u3.length - 2];
            }
            return n2;
          };
        } };
        var e = {};
        function __nccwpck_require__(u2) {
          var n = e[u2];
          if (n !== void 0) {
            return n.exports;
          }
          var o = e[u2] = { exports: {} };
          var s = true;
          try {
            t[u2](o, o.exports, __nccwpck_require__);
            s = false;
          } finally {
            if (s) delete e[u2];
          }
          return o.exports;
        }
        if (typeof __nccwpck_require__ !== "undefined") __nccwpck_require__.ab = __dirname + "/";
        var u = __nccwpck_require__(170);
        module.exports = u;
      })();
    }
  });

  // node_modules/next/dist/shared/lib/match-local-pattern.js
  var require_match_local_pattern = __commonJS({
    "node_modules/next/dist/shared/lib/match-local-pattern.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: all[name]
        });
      }
      _export(exports, {
        hasLocalMatch: function() {
          return hasLocalMatch;
        },
        matchLocalPattern: function() {
          return matchLocalPattern;
        }
      });
      var _picomatch = require_picomatch();
      function matchLocalPattern(pattern, url) {
        if (pattern.search !== void 0) {
          if (pattern.search !== url.search) {
            return false;
          }
        }
        if (!(0, _picomatch.makeRe)(pattern.pathname ?? "**", {
          dot: true
        }).test(url.pathname)) {
          return false;
        }
        return true;
      }
      function hasLocalMatch(localPatterns, urlPathAndQuery) {
        if (!localPatterns) {
          return true;
        }
        const url = new URL(urlPathAndQuery, "http://n");
        return localPatterns.some((p) => matchLocalPattern(p, url));
      }
    }
  });

  // node_modules/next/dist/shared/lib/match-remote-pattern.js
  var require_match_remote_pattern = __commonJS({
    "node_modules/next/dist/shared/lib/match-remote-pattern.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: all[name]
        });
      }
      _export(exports, {
        hasRemoteMatch: function() {
          return hasRemoteMatch;
        },
        matchRemotePattern: function() {
          return matchRemotePattern;
        }
      });
      var _picomatch = require_picomatch();
      function matchRemotePattern(pattern, url) {
        if (pattern.protocol !== void 0) {
          if (pattern.protocol.replace(/:$/, "") !== url.protocol.replace(/:$/, "")) {
            return false;
          }
        }
        if (pattern.port !== void 0) {
          if (pattern.port !== url.port) {
            return false;
          }
        }
        if (pattern.hostname === void 0) {
          throw Object.defineProperty(new Error(`Pattern should define hostname but found
${JSON.stringify(pattern)}`), "__NEXT_ERROR_CODE", {
            value: "E410",
            enumerable: false,
            configurable: true
          });
        } else {
          if (!(0, _picomatch.makeRe)(pattern.hostname).test(url.hostname)) {
            return false;
          }
        }
        if (pattern.search !== void 0) {
          if (pattern.search !== url.search) {
            return false;
          }
        }
        if (!(0, _picomatch.makeRe)(pattern.pathname ?? "**", {
          dot: true
        }).test(url.pathname)) {
          return false;
        }
        return true;
      }
      function hasRemoteMatch(domains, remotePatterns, url) {
        return domains.some((domain) => url.hostname === domain) || remotePatterns.some((p) => matchRemotePattern(p, url));
      }
    }
  });

  // node_modules/next/dist/shared/lib/image-loader.js
  var require_image_loader = __commonJS({
    "node_modules/next/dist/shared/lib/image-loader.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "default", {
        enumerable: true,
        get: function() {
          return _default;
        }
      });
      var _findclosestquality = require_find_closest_quality();
      var _deploymentid = require_deployment_id();
      function defaultLoader({ config, src, width, quality }) {
        if (true) {
          const missingValues = [];
          if (!src) missingValues.push("src");
          if (!width) missingValues.push("width");
          if (missingValues.length > 0) {
            throw Object.defineProperty(new Error(`Next Image Optimization requires ${missingValues.join(", ")} to be provided. Make sure you pass them as props to the \`next/image\` component. Received: ${JSON.stringify({
              src,
              width,
              quality
            })}`), "__NEXT_ERROR_CODE", {
              value: "E188",
              enumerable: false,
              configurable: true
            });
          }
        }
        let deploymentId = (0, _deploymentid.getDeploymentId)();
        if (src.startsWith("/") && !src.startsWith("//")) {
          const qIndex = src.indexOf("?");
          if (qIndex !== -1) {
            const params = new URLSearchParams(src.slice(qIndex + 1));
            const srcDpl = params.get("dpl");
            if (srcDpl) {
              deploymentId = srcDpl;
              params.delete("dpl");
              const remaining = params.toString();
              src = src.slice(0, qIndex) + (remaining ? "?" + remaining : "");
            }
          }
        }
        if (src.startsWith("/") && src.includes("?") && config.localPatterns?.length === 1 && config.localPatterns[0].pathname === "**" && config.localPatterns[0].search === "") {
          throw Object.defineProperty(new Error(`Image with src "${src}" is using a query string which is not configured in images.localPatterns.
Read more: https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns`), "__NEXT_ERROR_CODE", {
            value: "E871",
            enumerable: false,
            configurable: true
          });
        }
        if (true) {
          if (src.startsWith("//")) {
            throw Object.defineProperty(new Error(`Failed to parse src "${src}" on \`next/image\`, protocol-relative URL (//) must be changed to an absolute URL (http:// or https://)`), "__NEXT_ERROR_CODE", {
              value: "E360",
              enumerable: false,
              configurable: true
            });
          }
          if (src.startsWith("/") && config.localPatterns) {
            if (
              // micromatch isn't compatible with edge runtime
              process.env.NEXT_RUNTIME !== "edge"
            ) {
              const { hasLocalMatch } = require_match_local_pattern();
              if (!hasLocalMatch(config.localPatterns, src)) {
                throw Object.defineProperty(new Error(`Invalid src prop (${src}) on \`next/image\` does not match \`images.localPatterns\` configured in your \`next.config.js\`
See more info: https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns`), "__NEXT_ERROR_CODE", {
                  value: "E426",
                  enumerable: false,
                  configurable: true
                });
              }
            }
          }
          if (!src.startsWith("/") && (config.domains || config.remotePatterns)) {
            let parsedSrc;
            try {
              parsedSrc = new URL(src);
            } catch (err) {
              console.error(err);
              throw Object.defineProperty(new Error(`Failed to parse src "${src}" on \`next/image\`, if using relative image it must start with a leading slash "/" or be an absolute URL (http:// or https://)`), "__NEXT_ERROR_CODE", {
                value: "E63",
                enumerable: false,
                configurable: true
              });
            }
            if (
              // micromatch isn't compatible with edge runtime
              process.env.NEXT_RUNTIME !== "edge"
            ) {
              const { hasRemoteMatch } = require_match_remote_pattern();
              if (!hasRemoteMatch(config.domains, config.remotePatterns, parsedSrc)) {
                throw Object.defineProperty(new Error(`Invalid src prop (${src}) on \`next/image\`, hostname "${parsedSrc.hostname}" is not configured under images in your \`next.config.js\`
See more info: https://nextjs.org/docs/messages/next-image-unconfigured-host`), "__NEXT_ERROR_CODE", {
                  value: "E231",
                  enumerable: false,
                  configurable: true
                });
              }
            }
          }
        }
        const q = (0, _findclosestquality.findClosestQuality)(quality, config);
        return `${config.path}?url=${encodeURIComponent(src)}&w=${width}&q=${q}${src.startsWith("/") && deploymentId ? `&dpl=${deploymentId}` : ""}`;
      }
      defaultLoader.__next_img_default = true;
      var _default = defaultLoader;
    }
  });

  // node_modules/next/dist/client/use-merged-ref.js
  var require_use_merged_ref = __commonJS({
    "node_modules/next/dist/client/use-merged-ref.js"(exports, module) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "useMergedRef", {
        enumerable: true,
        get: function() {
          return useMergedRef;
        }
      });
      var _react = require_react_shim();
      function useMergedRef(refA, refB) {
        const cleanupA = (0, _react.useRef)(null);
        const cleanupB = (0, _react.useRef)(null);
        return (0, _react.useCallback)((current) => {
          if (current === null) {
            const cleanupFnA = cleanupA.current;
            if (cleanupFnA) {
              cleanupA.current = null;
              cleanupFnA();
            }
            const cleanupFnB = cleanupB.current;
            if (cleanupFnB) {
              cleanupB.current = null;
              cleanupFnB();
            }
          } else {
            if (refA) {
              cleanupA.current = applyRef(refA, current);
            }
            if (refB) {
              cleanupB.current = applyRef(refB, current);
            }
          }
        }, [
          refA,
          refB
        ]);
      }
      function applyRef(refA, current) {
        if (typeof refA === "function") {
          const cleanup = refA(current);
          if (typeof cleanup === "function") {
            return cleanup;
          } else {
            return () => refA(null);
          }
        } else {
          refA.current = current;
          return () => {
            refA.current = null;
          };
        }
      }
      if ((typeof exports.default === "function" || typeof exports.default === "object" && exports.default !== null) && typeof exports.default.__esModule === "undefined") {
        Object.defineProperty(exports.default, "__esModule", { value: true });
        Object.assign(exports.default, exports);
        module.exports = exports.default;
      }
    }
  });

  // node_modules/next/dist/client/image-component.js
  var require_image_component = __commonJS({
    "node_modules/next/dist/client/image-component.js"(exports, module) {
      "use client";
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "Image", {
        enumerable: true,
        get: function() {
          return Image2;
        }
      });
      var _interop_require_default = require_interop_require_default();
      var _interop_require_wildcard = require_interop_require_wildcard();
      var _jsxruntime = require_react_shim();
      var _react = /* @__PURE__ */ _interop_require_wildcard._(require_react_shim());
      var _reactdom = /* @__PURE__ */ _interop_require_default._(require_react_dom_shim());
      var _head = /* @__PURE__ */ _interop_require_default._(require_head());
      var _getimgprops = require_get_img_props();
      var _imageconfig = require_image_config();
      var _imageconfigcontextsharedruntime = require_image_config_context_shared_runtime();
      var _warnonce = require_warn_once();
      var _routercontextsharedruntime = require_router_context_shared_runtime();
      var _imageloader = /* @__PURE__ */ _interop_require_default._(require_image_loader());
      var _usemergedref = require_use_merged_ref();
      var configEnv = process.env.__NEXT_IMAGE_OPTS;
      if (typeof window === "undefined") {
        ;
        globalThis.__NEXT_IMAGE_IMPORTED = true;
      }
      function handleLoading(img, placeholder, onLoadRef, onLoadingCompleteRef, setBlurComplete, unoptimized, sizesInput) {
        const src = img?.src;
        if (!img || img["data-loaded-src"] === src) {
          return;
        }
        img["data-loaded-src"] = src;
        const p = "decode" in img ? img.decode() : Promise.resolve();
        p.catch(() => {
        }).then(() => {
          if (!img.parentElement || !img.isConnected) {
            return;
          }
          if (placeholder !== "empty") {
            setBlurComplete(true);
          }
          if (onLoadRef?.current) {
            const event = new Event("load");
            Object.defineProperty(event, "target", {
              writable: false,
              value: img
            });
            let prevented = false;
            let stopped = false;
            onLoadRef.current({
              ...event,
              nativeEvent: event,
              currentTarget: img,
              target: img,
              isDefaultPrevented: () => prevented,
              isPropagationStopped: () => stopped,
              persist: () => {
              },
              preventDefault: () => {
                prevented = true;
                event.preventDefault();
              },
              stopPropagation: () => {
                stopped = true;
                event.stopPropagation();
              }
            });
          }
          if (onLoadingCompleteRef?.current) {
            onLoadingCompleteRef.current(img);
          }
          if (true) {
            const origSrc = new URL(src, "http://n").searchParams.get("url") || src;
            if (img.getAttribute("data-nimg") === "fill") {
              if (!unoptimized && (!sizesInput || sizesInput === "100vw")) {
                let widthViewportRatio = img.getBoundingClientRect().width / window.innerWidth;
                if (widthViewportRatio < 0.6) {
                  if (sizesInput === "100vw") {
                    (0, _warnonce.warnOnce)(`Image with src "${origSrc}" has "fill" prop and "sizes" prop of "100vw", but image is not rendered at full viewport width. Please adjust "sizes" to improve page performance. Read more: https://nextjs.org/docs/api-reference/next/image#sizes`);
                  } else {
                    (0, _warnonce.warnOnce)(`Image with src "${origSrc}" has "fill" but is missing "sizes" prop. Please add it to improve page performance. Read more: https://nextjs.org/docs/api-reference/next/image#sizes`);
                  }
                }
              }
              if (img.parentElement) {
                const { position } = window.getComputedStyle(img.parentElement);
                const valid = [
                  "absolute",
                  "fixed",
                  "relative"
                ];
                if (!valid.includes(position)) {
                  (0, _warnonce.warnOnce)(`Image with src "${origSrc}" has "fill" and parent element with invalid "position". Provided "${position}" should be one of ${valid.map(String).join(",")}.`);
                }
              }
              if (img.height === 0) {
                (0, _warnonce.warnOnce)(`Image with src "${origSrc}" has "fill" and a height value of 0. This is likely because the parent element of the image has not been styled to have a set height.`);
              }
            }
            const heightModified = img.height.toString() !== img.getAttribute("height");
            const widthModified = img.width.toString() !== img.getAttribute("width");
            if (heightModified && !widthModified || !heightModified && widthModified) {
              (0, _warnonce.warnOnce)(`Image with src "${origSrc}" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio.`);
            }
          }
        });
      }
      function getDynamicProps(fetchPriority) {
        if (Boolean(_react.use)) {
          return {
            fetchPriority
          };
        }
        return {
          fetchpriority: fetchPriority
        };
      }
      var ImageElement = /* @__PURE__ */ (0, _react.forwardRef)(({ src, srcSet, sizes, height, width, decoding, className, style, fetchPriority, placeholder, loading, unoptimized, fill, onLoadRef, onLoadingCompleteRef, setBlurComplete, setShowAltText, sizesInput, onLoad, onError, ...rest }, forwardedRef) => {
        const ownRef = (0, _react.useCallback)((img) => {
          if (!img) {
            return;
          }
          if (onError) {
            img.src = img.src;
          }
          if (true) {
            if (!src) {
              console.error(`Image is missing required "src" property:`, img);
            }
            if (img.getAttribute("alt") === null) {
              console.error(`Image is missing required "alt" property. Please add Alternative Text to describe the image for screen readers and search engines.`);
            }
          }
          if (img.complete) {
            handleLoading(img, placeholder, onLoadRef, onLoadingCompleteRef, setBlurComplete, unoptimized, sizesInput);
          }
        }, [
          src,
          placeholder,
          onLoadRef,
          onLoadingCompleteRef,
          setBlurComplete,
          onError,
          unoptimized,
          sizesInput
        ]);
        const ref = (0, _usemergedref.useMergedRef)(forwardedRef, ownRef);
        return /* @__PURE__ */ (0, _jsxruntime.jsx)("img", {
          ...rest,
          ...getDynamicProps(fetchPriority),
          // It's intended to keep `loading` before `src` because React updates
          // props in order which causes Safari/Firefox to not lazy load properly.
          // See https://github.com/facebook/react/issues/25883
          loading,
          width,
          height,
          decoding,
          "data-nimg": fill ? "fill" : "1",
          className,
          style,
          // It's intended to keep `src` the last attribute because React updates
          // attributes in order. If we keep `src` the first one, Safari will
          // immediately start to fetch `src`, before `sizes` and `srcSet` are even
          // updated by React. That causes multiple unnecessary requests if `srcSet`
          // and `sizes` are defined.
          // This bug cannot be reproduced in Chrome or Firefox.
          sizes,
          srcSet,
          src,
          ref,
          onLoad: (event) => {
            const img = event.currentTarget;
            handleLoading(img, placeholder, onLoadRef, onLoadingCompleteRef, setBlurComplete, unoptimized, sizesInput);
          },
          onError: (event) => {
            setShowAltText(true);
            if (placeholder !== "empty") {
              setBlurComplete(true);
            }
            if (onError) {
              onError(event);
            }
          }
        });
      });
      function ImagePreload({ isAppRouter, imgAttributes }) {
        const opts = {
          as: "image",
          imageSrcSet: imgAttributes.srcSet,
          imageSizes: imgAttributes.sizes,
          crossOrigin: imgAttributes.crossOrigin,
          referrerPolicy: imgAttributes.referrerPolicy,
          ...getDynamicProps(imgAttributes.fetchPriority)
        };
        if (isAppRouter && _reactdom.default.preload) {
          _reactdom.default.preload(imgAttributes.src, opts);
          return null;
        }
        return /* @__PURE__ */ (0, _jsxruntime.jsx)(_head.default, {
          children: /* @__PURE__ */ (0, _jsxruntime.jsx)("link", {
            rel: "preload",
            // Note how we omit the `href` attribute, as it would only be relevant
            // for browsers that do not support `imagesrcset`, and in those cases
            // it would cause the incorrect image to be preloaded.
            //
            // https://html.spec.whatwg.org/multipage/semantics.html#attr-link-imagesrcset
            href: imgAttributes.srcSet ? void 0 : imgAttributes.src,
            ...opts
          }, "__nimg-" + imgAttributes.src + imgAttributes.srcSet + imgAttributes.sizes)
        });
      }
      var Image2 = /* @__PURE__ */ (0, _react.forwardRef)((props, forwardedRef) => {
        const pagesRouter = (0, _react.useContext)(_routercontextsharedruntime.RouterContext);
        const isAppRouter = !pagesRouter;
        const configContext = (0, _react.useContext)(_imageconfigcontextsharedruntime.ImageConfigContext);
        const config = (0, _react.useMemo)(() => {
          const c = configEnv || configContext || _imageconfig.imageConfigDefault;
          const allSizes = [
            ...c.deviceSizes,
            ...c.imageSizes
          ].sort((a, b) => a - b);
          const deviceSizes = c.deviceSizes.sort((a, b) => a - b);
          const qualities = c.qualities?.sort((a, b) => a - b);
          return {
            ...c,
            allSizes,
            deviceSizes,
            qualities,
            // During the SSR, configEnv (__NEXT_IMAGE_OPTS) does not include
            // security sensitive configs like `localPatterns`, which is needed
            // during the server render to ensure it's validated. Therefore use
            // configContext, which holds the config from the server for validation.
            localPatterns: typeof window === "undefined" ? configContext?.localPatterns : c.localPatterns
          };
        }, [
          configContext
        ]);
        const { onLoad, onLoadingComplete } = props;
        const onLoadRef = (0, _react.useRef)(onLoad);
        (0, _react.useEffect)(() => {
          onLoadRef.current = onLoad;
        }, [
          onLoad
        ]);
        const onLoadingCompleteRef = (0, _react.useRef)(onLoadingComplete);
        (0, _react.useEffect)(() => {
          onLoadingCompleteRef.current = onLoadingComplete;
        }, [
          onLoadingComplete
        ]);
        const [blurComplete, setBlurComplete] = (0, _react.useState)(false);
        const [showAltText, setShowAltText] = (0, _react.useState)(false);
        const { props: imgAttributes, meta: imgMeta } = (0, _getimgprops.getImgProps)(props, {
          defaultLoader: _imageloader.default,
          imgConf: config,
          blurComplete,
          showAltText
        });
        return /* @__PURE__ */ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
          children: [
            /* @__PURE__ */ (0, _jsxruntime.jsx)(ImageElement, {
              ...imgAttributes,
              unoptimized: imgMeta.unoptimized,
              placeholder: imgMeta.placeholder,
              fill: imgMeta.fill,
              onLoadRef,
              onLoadingCompleteRef,
              setBlurComplete,
              setShowAltText,
              sizesInput: props.sizes,
              ref: forwardedRef
            }),
            imgMeta.preload ? /* @__PURE__ */ (0, _jsxruntime.jsx)(ImagePreload, {
              isAppRouter,
              imgAttributes
            }) : null
          ]
        });
      });
      if ((typeof exports.default === "function" || typeof exports.default === "object" && exports.default !== null) && typeof exports.default.__esModule === "undefined") {
        Object.defineProperty(exports.default, "__esModule", { value: true });
        Object.assign(exports.default, exports);
        module.exports = exports.default;
      }
    }
  });

  // node_modules/next/dist/shared/lib/image-external.js
  var require_image_external = __commonJS({
    "node_modules/next/dist/shared/lib/image-external.js"(exports) {
      "use strict";
      init_define_import_meta_env();
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      function _export(target, all) {
        for (var name in all) Object.defineProperty(target, name, {
          enumerable: true,
          get: all[name]
        });
      }
      _export(exports, {
        default: function() {
          return _default;
        },
        getImageProps: function() {
          return getImageProps;
        }
      });
      var _interop_require_default = require_interop_require_default();
      var _getimgprops = require_get_img_props();
      var _imagecomponent = require_image_component();
      var _imageloader = /* @__PURE__ */ _interop_require_default._(require_image_loader());
      function getImageProps(imgProps) {
        const { props } = (0, _getimgprops.getImgProps)(imgProps, {
          defaultLoader: _imageloader.default,
          // This is replaced by webpack define plugin
          imgConf: process.env.__NEXT_IMAGE_OPTS
        });
        for (const [key, value] of Object.entries(props)) {
          if (value === void 0) {
            delete props[key];
          }
        }
        return {
          props
        };
      }
      var _default = _imagecomponent.Image;
    }
  });

  // node_modules/next/image.js
  var require_image = __commonJS({
    "node_modules/next/image.js"(exports, module) {
      init_define_import_meta_env();
      module.exports = require_image_external();
    }
  });

  // .design-sync/entry.ts
  var entry_exports = {};
  __export(entry_exports, {
    Badge: () => Badge,
    Button: () => Button,
    CardGrid: () => CardGrid,
    ComparisonTable: () => ComparisonTable,
    GridCell: () => GridCell,
    Hero: () => Hero,
    InkCTA: () => InkCTA,
    Lead: () => Lead,
    Marquee: () => Marquee,
    Overline: () => Overline,
    PointList: () => PointList,
    Section: () => Section,
    SectionHeading: () => SectionHeading,
    StatStrip: () => StatStrip,
    StepCard: () => StepCard,
    Tag: () => Tag,
    TierCard: () => TierCard,
    TrustBar: () => TrustBar,
    Wordmark: () => Wordmark
  });
  init_define_import_meta_env();

  // components/landing/button.tsx
  init_define_import_meta_env();

  // node_modules/lucide-react/dist/esm/lucide-react.mjs
  init_define_import_meta_env();

  // node_modules/lucide-react/dist/esm/createLucideIcon.mjs
  init_define_import_meta_env();
  var import_react3 = __toESM(require_react_shim(), 1);

  // node_modules/lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs
  init_define_import_meta_env();
  var mergeClasses = (...classes) => classes.filter((className, index, array) => {
    return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
  }).join(" ").trim();

  // node_modules/lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs
  init_define_import_meta_env();
  var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

  // node_modules/lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs
  init_define_import_meta_env();

  // node_modules/lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs
  init_define_import_meta_env();
  var toCamelCase = (string) => string.replace(
    /^([A-Z])|[\s-_]+(\w)/g,
    (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
  );

  // node_modules/lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs
  var toPascalCase = (string) => {
    const camelCase = toCamelCase(string);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  };

  // node_modules/lucide-react/dist/esm/Icon.mjs
  init_define_import_meta_env();
  var import_react2 = __toESM(require_react_shim(), 1);

  // node_modules/lucide-react/dist/esm/defaultAttributes.mjs
  init_define_import_meta_env();
  var defaultAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  // node_modules/lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs
  init_define_import_meta_env();
  var hasA11yProp = (props) => {
    for (const prop in props) {
      if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
        return true;
      }
    }
    return false;
  };

  // node_modules/lucide-react/dist/esm/context.mjs
  init_define_import_meta_env();
  var import_react = __toESM(require_react_shim(), 1);
  var LucideContext = (0, import_react.createContext)({});
  var useLucideContext = () => (0, import_react.useContext)(LucideContext);

  // node_modules/lucide-react/dist/esm/Icon.mjs
  var Icon = (0, import_react2.forwardRef)(
    ({ color, size, strokeWidth, absoluteStrokeWidth, className = "", children, iconNode, ...rest }, ref) => {
      const {
        size: contextSize = 24,
        strokeWidth: contextStrokeWidth = 2,
        absoluteStrokeWidth: contextAbsoluteStrokeWidth = false,
        color: contextColor = "currentColor",
        className: contextClass = ""
      } = useLucideContext() ?? {};
      const calculatedStrokeWidth = absoluteStrokeWidth ?? contextAbsoluteStrokeWidth ? Number(strokeWidth ?? contextStrokeWidth) * 24 / Number(size ?? contextSize) : strokeWidth ?? contextStrokeWidth;
      return (0, import_react2.createElement)(
        "svg",
        {
          ref,
          ...defaultAttributes,
          width: size ?? contextSize ?? defaultAttributes.width,
          height: size ?? contextSize ?? defaultAttributes.height,
          stroke: color ?? contextColor,
          strokeWidth: calculatedStrokeWidth,
          className: mergeClasses("lucide", contextClass, className),
          ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
          ...rest
        },
        [
          ...iconNode.map(([tag, attrs]) => (0, import_react2.createElement)(tag, attrs)),
          ...Array.isArray(children) ? children : [children]
        ]
      );
    }
  );

  // node_modules/lucide-react/dist/esm/createLucideIcon.mjs
  var createLucideIcon = (iconName, iconNode) => {
    const Component = (0, import_react3.forwardRef)(
      ({ className, ...props }, ref) => (0, import_react3.createElement)(Icon, {
        ref,
        iconNode,
        className: mergeClasses(
          `lucide-${toKebabCase(toPascalCase(iconName))}`,
          `lucide-${iconName}`,
          className
        ),
        ...props
      })
    );
    Component.displayName = toPascalCase(iconName);
    return Component;
  };

  // node_modules/lucide-react/dist/esm/icons/arrow-up-right.mjs
  init_define_import_meta_env();
  var __iconNode = [
    ["path", { d: "M7 7h10v10", key: "1tivn9" }],
    ["path", { d: "M7 17 17 7", key: "1vkiza" }]
  ];
  var ArrowUpRight = createLucideIcon("arrow-up-right", __iconNode);

  // node_modules/lucide-react/dist/esm/icons/check.mjs
  init_define_import_meta_env();
  var __iconNode2 = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]];
  var Check = createLucideIcon("check", __iconNode2);

  // node_modules/lucide-react/dist/esm/icons/mail.mjs
  init_define_import_meta_env();
  var __iconNode3 = [
    ["path", { d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7", key: "132q7q" }],
    ["rect", { x: "2", y: "4", width: "20", height: "16", rx: "2", key: "izxlao" }]
  ];
  var Mail = createLucideIcon("mail", __iconNode3);

  // node_modules/lucide-react/dist/esm/icons/minus.mjs
  init_define_import_meta_env();
  var __iconNode4 = [["path", { d: "M5 12h14", key: "1ays0h" }]];
  var Minus = createLucideIcon("minus", __iconNode4);

  // lib/utils.ts
  init_define_import_meta_env();

  // node_modules/clsx/dist/clsx.mjs
  init_define_import_meta_env();
  function r(e) {
    var t, f, n = "";
    if ("string" == typeof e || "number" == typeof e) n += e;
    else if ("object" == typeof e) if (Array.isArray(e)) {
      var o = e.length;
      for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
    } else for (f in e) e[f] && (n && (n += " "), n += f);
    return n;
  }
  function clsx() {
    for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
    return n;
  }

  // node_modules/tailwind-merge/dist/bundle-mjs.mjs
  init_define_import_meta_env();
  var concatArrays = (array1, array2) => {
    const combinedArray = new Array(array1.length + array2.length);
    for (let i = 0; i < array1.length; i++) {
      combinedArray[i] = array1[i];
    }
    for (let i = 0; i < array2.length; i++) {
      combinedArray[array1.length + i] = array2[i];
    }
    return combinedArray;
  };
  var createClassValidatorObject = (classGroupId, validator) => ({
    classGroupId,
    validator
  });
  var createClassPartObject = (nextPart = /* @__PURE__ */ new Map(), validators = null, classGroupId) => ({
    nextPart,
    validators,
    classGroupId
  });
  var CLASS_PART_SEPARATOR = "-";
  var EMPTY_CONFLICTS = [];
  var ARBITRARY_PROPERTY_PREFIX = "arbitrary..";
  var createClassGroupUtils = (config) => {
    const classMap = createClassMap(config);
    const {
      conflictingClassGroups,
      conflictingClassGroupModifiers
    } = config;
    const getClassGroupId = (className) => {
      if (className.startsWith("[") && className.endsWith("]")) {
        return getGroupIdForArbitraryProperty(className);
      }
      const classParts = className.split(CLASS_PART_SEPARATOR);
      const startIndex = classParts[0] === "" && classParts.length > 1 ? 1 : 0;
      return getGroupRecursive(classParts, startIndex, classMap);
    };
    const getConflictingClassGroupIds = (classGroupId, hasPostfixModifier) => {
      if (hasPostfixModifier) {
        const modifierConflicts = conflictingClassGroupModifiers[classGroupId];
        const baseConflicts = conflictingClassGroups[classGroupId];
        if (modifierConflicts) {
          if (baseConflicts) {
            return concatArrays(baseConflicts, modifierConflicts);
          }
          return modifierConflicts;
        }
        return baseConflicts || EMPTY_CONFLICTS;
      }
      return conflictingClassGroups[classGroupId] || EMPTY_CONFLICTS;
    };
    return {
      getClassGroupId,
      getConflictingClassGroupIds
    };
  };
  var getGroupRecursive = (classParts, startIndex, classPartObject) => {
    const classPathsLength = classParts.length - startIndex;
    if (classPathsLength === 0) {
      return classPartObject.classGroupId;
    }
    const currentClassPart = classParts[startIndex];
    const nextClassPartObject = classPartObject.nextPart.get(currentClassPart);
    if (nextClassPartObject) {
      const result = getGroupRecursive(classParts, startIndex + 1, nextClassPartObject);
      if (result) return result;
    }
    const validators = classPartObject.validators;
    if (validators === null) {
      return void 0;
    }
    const classRest = startIndex === 0 ? classParts.join(CLASS_PART_SEPARATOR) : classParts.slice(startIndex).join(CLASS_PART_SEPARATOR);
    const validatorsLength = validators.length;
    for (let i = 0; i < validatorsLength; i++) {
      const validatorObj = validators[i];
      if (validatorObj.validator(classRest)) {
        return validatorObj.classGroupId;
      }
    }
    return void 0;
  };
  var getGroupIdForArbitraryProperty = (className) => className.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
    const content = className.slice(1, -1);
    const colonIndex = content.indexOf(":");
    const property = content.slice(0, colonIndex);
    return property ? ARBITRARY_PROPERTY_PREFIX + property : void 0;
  })();
  var createClassMap = (config) => {
    const {
      theme,
      classGroups
    } = config;
    return processClassGroups(classGroups, theme);
  };
  var processClassGroups = (classGroups, theme) => {
    const classMap = createClassPartObject();
    for (const classGroupId in classGroups) {
      const group = classGroups[classGroupId];
      processClassesRecursively(group, classMap, classGroupId, theme);
    }
    return classMap;
  };
  var processClassesRecursively = (classGroup, classPartObject, classGroupId, theme) => {
    const len = classGroup.length;
    for (let i = 0; i < len; i++) {
      const classDefinition = classGroup[i];
      processClassDefinition(classDefinition, classPartObject, classGroupId, theme);
    }
  };
  var processClassDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
    if (typeof classDefinition === "string") {
      processStringDefinition(classDefinition, classPartObject, classGroupId);
      return;
    }
    if (typeof classDefinition === "function") {
      processFunctionDefinition(classDefinition, classPartObject, classGroupId, theme);
      return;
    }
    processObjectDefinition(classDefinition, classPartObject, classGroupId, theme);
  };
  var processStringDefinition = (classDefinition, classPartObject, classGroupId) => {
    const classPartObjectToEdit = classDefinition === "" ? classPartObject : getPart(classPartObject, classDefinition);
    classPartObjectToEdit.classGroupId = classGroupId;
  };
  var processFunctionDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
    if (isThemeGetter(classDefinition)) {
      processClassesRecursively(classDefinition(theme), classPartObject, classGroupId, theme);
      return;
    }
    if (classPartObject.validators === null) {
      classPartObject.validators = [];
    }
    classPartObject.validators.push(createClassValidatorObject(classGroupId, classDefinition));
  };
  var processObjectDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
    const entries = Object.entries(classDefinition);
    const len = entries.length;
    for (let i = 0; i < len; i++) {
      const [key, value] = entries[i];
      processClassesRecursively(value, getPart(classPartObject, key), classGroupId, theme);
    }
  };
  var getPart = (classPartObject, path) => {
    let current = classPartObject;
    const parts = path.split(CLASS_PART_SEPARATOR);
    const len = parts.length;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      let next = current.nextPart.get(part);
      if (!next) {
        next = createClassPartObject();
        current.nextPart.set(part, next);
      }
      current = next;
    }
    return current;
  };
  var isThemeGetter = (func) => "isThemeGetter" in func && func.isThemeGetter === true;
  var createLruCache = (maxCacheSize) => {
    if (maxCacheSize < 1) {
      return {
        get: () => void 0,
        set: () => {
        }
      };
    }
    let cacheSize = 0;
    let cache = /* @__PURE__ */ Object.create(null);
    let previousCache = /* @__PURE__ */ Object.create(null);
    const update = (key, value) => {
      cache[key] = value;
      cacheSize++;
      if (cacheSize > maxCacheSize) {
        cacheSize = 0;
        previousCache = cache;
        cache = /* @__PURE__ */ Object.create(null);
      }
    };
    return {
      get(key) {
        let value = cache[key];
        if (value !== void 0) {
          return value;
        }
        if ((value = previousCache[key]) !== void 0) {
          update(key, value);
          return value;
        }
      },
      set(key, value) {
        if (key in cache) {
          cache[key] = value;
        } else {
          update(key, value);
        }
      }
    };
  };
  var IMPORTANT_MODIFIER = "!";
  var MODIFIER_SEPARATOR = ":";
  var EMPTY_MODIFIERS = [];
  var createResultObject = (modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition, isExternal) => ({
    modifiers,
    hasImportantModifier,
    baseClassName,
    maybePostfixModifierPosition,
    isExternal
  });
  var createParseClassName = (config) => {
    const {
      prefix,
      experimentalParseClassName
    } = config;
    let parseClassName = (className) => {
      const modifiers = [];
      let bracketDepth = 0;
      let parenDepth = 0;
      let modifierStart = 0;
      let postfixModifierPosition;
      const len = className.length;
      for (let index = 0; index < len; index++) {
        const currentCharacter = className[index];
        if (bracketDepth === 0 && parenDepth === 0) {
          if (currentCharacter === MODIFIER_SEPARATOR) {
            modifiers.push(className.slice(modifierStart, index));
            modifierStart = index + 1;
            continue;
          }
          if (currentCharacter === "/") {
            postfixModifierPosition = index;
            continue;
          }
        }
        if (currentCharacter === "[") bracketDepth++;
        else if (currentCharacter === "]") bracketDepth--;
        else if (currentCharacter === "(") parenDepth++;
        else if (currentCharacter === ")") parenDepth--;
      }
      const baseClassNameWithImportantModifier = modifiers.length === 0 ? className : className.slice(modifierStart);
      let baseClassName = baseClassNameWithImportantModifier;
      let hasImportantModifier = false;
      if (baseClassNameWithImportantModifier.endsWith(IMPORTANT_MODIFIER)) {
        baseClassName = baseClassNameWithImportantModifier.slice(0, -1);
        hasImportantModifier = true;
      } else if (
        /**
         * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
         * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
         */
        baseClassNameWithImportantModifier.startsWith(IMPORTANT_MODIFIER)
      ) {
        baseClassName = baseClassNameWithImportantModifier.slice(1);
        hasImportantModifier = true;
      }
      const maybePostfixModifierPosition = postfixModifierPosition && postfixModifierPosition > modifierStart ? postfixModifierPosition - modifierStart : void 0;
      return createResultObject(modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition);
    };
    if (prefix) {
      const fullPrefix = prefix + MODIFIER_SEPARATOR;
      const parseClassNameOriginal = parseClassName;
      parseClassName = (className) => className.startsWith(fullPrefix) ? parseClassNameOriginal(className.slice(fullPrefix.length)) : createResultObject(EMPTY_MODIFIERS, false, className, void 0, true);
    }
    if (experimentalParseClassName) {
      const parseClassNameOriginal = parseClassName;
      parseClassName = (className) => experimentalParseClassName({
        className,
        parseClassName: parseClassNameOriginal
      });
    }
    return parseClassName;
  };
  var createSortModifiers = (config) => {
    const modifierWeights = /* @__PURE__ */ new Map();
    config.orderSensitiveModifiers.forEach((mod, index) => {
      modifierWeights.set(mod, 1e6 + index);
    });
    return (modifiers) => {
      const result = [];
      let currentSegment = [];
      for (let i = 0; i < modifiers.length; i++) {
        const modifier = modifiers[i];
        const isArbitrary = modifier[0] === "[";
        const isOrderSensitive = modifierWeights.has(modifier);
        if (isArbitrary || isOrderSensitive) {
          if (currentSegment.length > 0) {
            currentSegment.sort();
            result.push(...currentSegment);
            currentSegment = [];
          }
          result.push(modifier);
        } else {
          currentSegment.push(modifier);
        }
      }
      if (currentSegment.length > 0) {
        currentSegment.sort();
        result.push(...currentSegment);
      }
      return result;
    };
  };
  var createConfigUtils = (config) => ({
    cache: createLruCache(config.cacheSize),
    parseClassName: createParseClassName(config),
    sortModifiers: createSortModifiers(config),
    postfixLookupClassGroupIds: createPostfixLookupClassGroupIds(config),
    ...createClassGroupUtils(config)
  });
  var createPostfixLookupClassGroupIds = (config) => {
    const lookup = /* @__PURE__ */ Object.create(null);
    const classGroupIds = config.postfixLookupClassGroups;
    if (classGroupIds) {
      for (let i = 0; i < classGroupIds.length; i++) {
        lookup[classGroupIds[i]] = true;
      }
    }
    return lookup;
  };
  var SPLIT_CLASSES_REGEX = /\s+/;
  var mergeClassList = (classList, configUtils) => {
    const {
      parseClassName,
      getClassGroupId,
      getConflictingClassGroupIds,
      sortModifiers,
      postfixLookupClassGroupIds
    } = configUtils;
    const classGroupsInConflict = [];
    const classNames = classList.trim().split(SPLIT_CLASSES_REGEX);
    let result = "";
    for (let index = classNames.length - 1; index >= 0; index -= 1) {
      const originalClassName = classNames[index];
      const {
        isExternal,
        modifiers,
        hasImportantModifier,
        baseClassName,
        maybePostfixModifierPosition
      } = parseClassName(originalClassName);
      if (isExternal) {
        result = originalClassName + (result.length > 0 ? " " + result : result);
        continue;
      }
      let hasPostfixModifier = !!maybePostfixModifierPosition;
      let classGroupId;
      if (hasPostfixModifier) {
        const baseClassNameWithoutPostfix = baseClassName.substring(0, maybePostfixModifierPosition);
        classGroupId = getClassGroupId(baseClassNameWithoutPostfix);
        const classGroupIdWithPostfix = classGroupId && postfixLookupClassGroupIds[classGroupId] ? getClassGroupId(baseClassName) : void 0;
        if (classGroupIdWithPostfix && classGroupIdWithPostfix !== classGroupId) {
          classGroupId = classGroupIdWithPostfix;
          hasPostfixModifier = false;
        }
      } else {
        classGroupId = getClassGroupId(baseClassName);
      }
      if (!classGroupId) {
        if (!hasPostfixModifier) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        classGroupId = getClassGroupId(baseClassName);
        if (!classGroupId) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        hasPostfixModifier = false;
      }
      const variantModifier = modifiers.length === 0 ? "" : modifiers.length === 1 ? modifiers[0] : sortModifiers(modifiers).join(":");
      const modifierId = hasImportantModifier ? variantModifier + IMPORTANT_MODIFIER : variantModifier;
      const classId = modifierId + classGroupId;
      if (classGroupsInConflict.indexOf(classId) > -1) {
        continue;
      }
      classGroupsInConflict.push(classId);
      const conflictGroups = getConflictingClassGroupIds(classGroupId, hasPostfixModifier);
      for (let i = 0; i < conflictGroups.length; ++i) {
        const group = conflictGroups[i];
        classGroupsInConflict.push(modifierId + group);
      }
      result = originalClassName + (result.length > 0 ? " " + result : result);
    }
    return result;
  };
  var twJoin = (...classLists) => {
    let index = 0;
    let argument;
    let resolvedValue;
    let string = "";
    while (index < classLists.length) {
      if (argument = classLists[index++]) {
        if (resolvedValue = toValue(argument)) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  };
  var toValue = (mix) => {
    if (typeof mix === "string") {
      return mix;
    }
    let resolvedValue;
    let string = "";
    for (let k = 0; k < mix.length; k++) {
      if (mix[k]) {
        if (resolvedValue = toValue(mix[k])) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  };
  var createTailwindMerge = (createConfigFirst, ...createConfigRest) => {
    let configUtils;
    let cacheGet;
    let cacheSet;
    let functionToCall;
    const initTailwindMerge = (classList) => {
      const config = createConfigRest.reduce((previousConfig, createConfigCurrent) => createConfigCurrent(previousConfig), createConfigFirst());
      configUtils = createConfigUtils(config);
      cacheGet = configUtils.cache.get;
      cacheSet = configUtils.cache.set;
      functionToCall = tailwindMerge;
      return tailwindMerge(classList);
    };
    const tailwindMerge = (classList) => {
      const cachedResult = cacheGet(classList);
      if (cachedResult) {
        return cachedResult;
      }
      const result = mergeClassList(classList, configUtils);
      cacheSet(classList, result);
      return result;
    };
    functionToCall = initTailwindMerge;
    return (...args) => functionToCall(twJoin(...args));
  };
  var fallbackThemeArr = [];
  var fromTheme = (key) => {
    const themeGetter = (theme) => theme[key] || fallbackThemeArr;
    themeGetter.isThemeGetter = true;
    return themeGetter;
  };
  var arbitraryValueRegex = /^\[(?:(\w[\w-]*):)?(.+)\]$/i;
  var arbitraryVariableRegex = /^\((?:(\w[\w-]*):)?(.+)\)$/i;
  var fractionRegex = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/;
  var tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
  var lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
  var colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/;
  var shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
  var imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
  var isFraction = (value) => fractionRegex.test(value);
  var isNumber = (value) => !!value && !Number.isNaN(Number(value));
  var isInteger = (value) => !!value && Number.isInteger(Number(value));
  var isPercent = (value) => value.endsWith("%") && isNumber(value.slice(0, -1));
  var isTshirtSize = (value) => tshirtUnitRegex.test(value);
  var isAny = () => true;
  var isLengthOnly = (value) => (
    // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
    // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
    // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
    lengthUnitRegex.test(value) && !colorFunctionRegex.test(value)
  );
  var isNever = () => false;
  var isShadow = (value) => shadowRegex.test(value);
  var isImage = (value) => imageRegex.test(value);
  var isAnyNonArbitrary = (value) => !isArbitraryValue(value) && !isArbitraryVariable(value);
  var isNamedContainerQuery = (value) => value.startsWith("@container") && (value[10] === "/" && value[11] !== void 0 || value[11] === "s" && value[16] !== void 0 && value.startsWith("-size/", 10) || value[11] === "n" && value[18] !== void 0 && value.startsWith("-normal/", 10));
  var isArbitrarySize = (value) => getIsArbitraryValue(value, isLabelSize, isNever);
  var isArbitraryValue = (value) => arbitraryValueRegex.test(value);
  var isArbitraryLength = (value) => getIsArbitraryValue(value, isLabelLength, isLengthOnly);
  var isArbitraryNumber = (value) => getIsArbitraryValue(value, isLabelNumber, isNumber);
  var isArbitraryWeight = (value) => getIsArbitraryValue(value, isLabelWeight, isAny);
  var isArbitraryFamilyName = (value) => getIsArbitraryValue(value, isLabelFamilyName, isNever);
  var isArbitraryPosition = (value) => getIsArbitraryValue(value, isLabelPosition, isNever);
  var isArbitraryImage = (value) => getIsArbitraryValue(value, isLabelImage, isImage);
  var isArbitraryShadow = (value) => getIsArbitraryValue(value, isLabelShadow, isShadow);
  var isArbitraryVariable = (value) => arbitraryVariableRegex.test(value);
  var isArbitraryVariableLength = (value) => getIsArbitraryVariable(value, isLabelLength);
  var isArbitraryVariableFamilyName = (value) => getIsArbitraryVariable(value, isLabelFamilyName);
  var isArbitraryVariablePosition = (value) => getIsArbitraryVariable(value, isLabelPosition);
  var isArbitraryVariableSize = (value) => getIsArbitraryVariable(value, isLabelSize);
  var isArbitraryVariableImage = (value) => getIsArbitraryVariable(value, isLabelImage);
  var isArbitraryVariableShadow = (value) => getIsArbitraryVariable(value, isLabelShadow, true);
  var isArbitraryVariableWeight = (value) => getIsArbitraryVariable(value, isLabelWeight, true);
  var getIsArbitraryValue = (value, testLabel, testValue) => {
    const result = arbitraryValueRegex.exec(value);
    if (result) {
      if (result[1]) {
        return testLabel(result[1]);
      }
      return testValue(result[2]);
    }
    return false;
  };
  var getIsArbitraryVariable = (value, testLabel, shouldMatchNoLabel = false) => {
    const result = arbitraryVariableRegex.exec(value);
    if (result) {
      if (result[1]) {
        return testLabel(result[1]);
      }
      return shouldMatchNoLabel;
    }
    return false;
  };
  var isLabelPosition = (label) => label === "position" || label === "percentage";
  var isLabelImage = (label) => label === "image" || label === "url";
  var isLabelSize = (label) => label === "length" || label === "size" || label === "bg-size";
  var isLabelLength = (label) => label === "length";
  var isLabelNumber = (label) => label === "number";
  var isLabelFamilyName = (label) => label === "family-name";
  var isLabelWeight = (label) => label === "number" || label === "weight";
  var isLabelShadow = (label) => label === "shadow";
  var getDefaultConfig = () => {
    const themeColor = fromTheme("color");
    const themeFont = fromTheme("font");
    const themeText = fromTheme("text");
    const themeFontWeight = fromTheme("font-weight");
    const themeTracking = fromTheme("tracking");
    const themeLeading = fromTheme("leading");
    const themeBreakpoint = fromTheme("breakpoint");
    const themeContainer = fromTheme("container");
    const themeSpacing = fromTheme("spacing");
    const themeRadius = fromTheme("radius");
    const themeShadow = fromTheme("shadow");
    const themeInsetShadow = fromTheme("inset-shadow");
    const themeTextShadow = fromTheme("text-shadow");
    const themeDropShadow = fromTheme("drop-shadow");
    const themeBlur = fromTheme("blur");
    const themePerspective = fromTheme("perspective");
    const themeAspect = fromTheme("aspect");
    const themeEase = fromTheme("ease");
    const themeAnimate = fromTheme("animate");
    const scaleBreak = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"];
    const scalePosition = () => [
      "center",
      "top",
      "bottom",
      "left",
      "right",
      "top-left",
      // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
      "left-top",
      "top-right",
      // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
      "right-top",
      "bottom-right",
      // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
      "right-bottom",
      "bottom-left",
      // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
      "left-bottom"
    ];
    const scalePositionWithArbitrary = () => [...scalePosition(), isArbitraryVariable, isArbitraryValue];
    const scaleOverflow = () => ["auto", "hidden", "clip", "visible", "scroll"];
    const scaleOverscroll = () => ["auto", "contain", "none"];
    const scaleUnambiguousSpacing = () => [isArbitraryVariable, isArbitraryValue, themeSpacing];
    const scaleInset = () => [isFraction, "full", "auto", ...scaleUnambiguousSpacing()];
    const scaleGridTemplateColsRows = () => [isInteger, "none", "subgrid", isArbitraryVariable, isArbitraryValue];
    const scaleGridColRowStartAndEnd = () => ["auto", {
      span: ["full", isInteger, isArbitraryVariable, isArbitraryValue]
    }, isInteger, isArbitraryVariable, isArbitraryValue];
    const scaleGridColRowStartOrEnd = () => [isInteger, "auto", isArbitraryVariable, isArbitraryValue];
    const scaleGridAutoColsRows = () => ["auto", "min", "max", "fr", isArbitraryVariable, isArbitraryValue];
    const scaleAlignPrimaryAxis = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"];
    const scaleAlignSecondaryAxis = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"];
    const scaleMargin = () => ["auto", ...scaleUnambiguousSpacing()];
    const scaleSizing = () => [isFraction, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...scaleUnambiguousSpacing()];
    const scaleSizingInline = () => [isFraction, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...scaleUnambiguousSpacing()];
    const scaleSizingBlock = () => [isFraction, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...scaleUnambiguousSpacing()];
    const scaleColor = () => [themeColor, isArbitraryVariable, isArbitraryValue];
    const scaleBgPosition = () => [...scalePosition(), isArbitraryVariablePosition, isArbitraryPosition, {
      position: [isArbitraryVariable, isArbitraryValue]
    }];
    const scaleBgRepeat = () => ["no-repeat", {
      repeat: ["", "x", "y", "space", "round"]
    }];
    const scaleBgSize = () => ["auto", "cover", "contain", isArbitraryVariableSize, isArbitrarySize, {
      size: [isArbitraryVariable, isArbitraryValue]
    }];
    const scaleGradientStopPosition = () => [isPercent, isArbitraryVariableLength, isArbitraryLength];
    const scaleRadius = () => [
      // Deprecated since Tailwind CSS v4.0.0
      "",
      "none",
      "full",
      themeRadius,
      isArbitraryVariable,
      isArbitraryValue
    ];
    const scaleBorderWidth = () => ["", isNumber, isArbitraryVariableLength, isArbitraryLength];
    const scaleLineStyle = () => ["solid", "dashed", "dotted", "double"];
    const scaleBlendMode = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
    const scaleMaskImagePosition = () => [isNumber, isPercent, isArbitraryVariablePosition, isArbitraryPosition];
    const scaleBlur = () => [
      // Deprecated since Tailwind CSS v4.0.0
      "",
      "none",
      themeBlur,
      isArbitraryVariable,
      isArbitraryValue
    ];
    const scaleRotate = () => ["none", isNumber, isArbitraryVariable, isArbitraryValue];
    const scaleScale = () => ["none", isNumber, isArbitraryVariable, isArbitraryValue];
    const scaleSkew = () => [isNumber, isArbitraryVariable, isArbitraryValue];
    const scaleTranslate = () => [isFraction, "full", ...scaleUnambiguousSpacing()];
    return {
      cacheSize: 500,
      theme: {
        animate: ["spin", "ping", "pulse", "bounce"],
        aspect: ["video"],
        blur: [isTshirtSize],
        breakpoint: [isTshirtSize],
        color: [isAny],
        container: [isTshirtSize],
        "drop-shadow": [isTshirtSize],
        ease: ["in", "out", "in-out"],
        font: [isAnyNonArbitrary],
        "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
        "inset-shadow": [isTshirtSize],
        leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
        perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
        radius: [isTshirtSize],
        shadow: [isTshirtSize],
        spacing: ["px", isNumber],
        text: [isTshirtSize],
        "text-shadow": [isTshirtSize],
        tracking: ["tighter", "tight", "normal", "wide", "wider", "widest"]
      },
      classGroups: {
        // --------------
        // --- Layout ---
        // --------------
        /**
         * Aspect Ratio
         * @see https://tailwindcss.com/docs/aspect-ratio
         */
        aspect: [{
          aspect: ["auto", "square", isFraction, isArbitraryValue, isArbitraryVariable, themeAspect]
        }],
        /**
         * Container
         * @see https://tailwindcss.com/docs/container
         * @deprecated since Tailwind CSS v4.0.0
         */
        container: ["container"],
        /**
         * Container Type
         * @see https://tailwindcss.com/docs/responsive-design#container-queries
         */
        "container-type": [{
          "@container": ["", "normal", "size", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Container Name
         * @see https://tailwindcss.com/docs/responsive-design#named-containers
         */
        "container-named": [isNamedContainerQuery],
        /**
         * Columns
         * @see https://tailwindcss.com/docs/columns
         */
        columns: [{
          columns: [isNumber, isArbitraryValue, isArbitraryVariable, themeContainer]
        }],
        /**
         * Break After
         * @see https://tailwindcss.com/docs/break-after
         */
        "break-after": [{
          "break-after": scaleBreak()
        }],
        /**
         * Break Before
         * @see https://tailwindcss.com/docs/break-before
         */
        "break-before": [{
          "break-before": scaleBreak()
        }],
        /**
         * Break Inside
         * @see https://tailwindcss.com/docs/break-inside
         */
        "break-inside": [{
          "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
        }],
        /**
         * Box Decoration Break
         * @see https://tailwindcss.com/docs/box-decoration-break
         */
        "box-decoration": [{
          "box-decoration": ["slice", "clone"]
        }],
        /**
         * Box Sizing
         * @see https://tailwindcss.com/docs/box-sizing
         */
        box: [{
          box: ["border", "content"]
        }],
        /**
         * Display
         * @see https://tailwindcss.com/docs/display
         */
        display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
        /**
         * Screen Reader Only
         * @see https://tailwindcss.com/docs/display#screen-reader-only
         */
        sr: ["sr-only", "not-sr-only"],
        /**
         * Floats
         * @see https://tailwindcss.com/docs/float
         */
        float: [{
          float: ["right", "left", "none", "start", "end"]
        }],
        /**
         * Clear
         * @see https://tailwindcss.com/docs/clear
         */
        clear: [{
          clear: ["left", "right", "both", "none", "start", "end"]
        }],
        /**
         * Isolation
         * @see https://tailwindcss.com/docs/isolation
         */
        isolation: ["isolate", "isolation-auto"],
        /**
         * Object Fit
         * @see https://tailwindcss.com/docs/object-fit
         */
        "object-fit": [{
          object: ["contain", "cover", "fill", "none", "scale-down"]
        }],
        /**
         * Object Position
         * @see https://tailwindcss.com/docs/object-position
         */
        "object-position": [{
          object: scalePositionWithArbitrary()
        }],
        /**
         * Overflow
         * @see https://tailwindcss.com/docs/overflow
         */
        overflow: [{
          overflow: scaleOverflow()
        }],
        /**
         * Overflow X
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-x": [{
          "overflow-x": scaleOverflow()
        }],
        /**
         * Overflow Y
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-y": [{
          "overflow-y": scaleOverflow()
        }],
        /**
         * Overscroll Behavior
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        overscroll: [{
          overscroll: scaleOverscroll()
        }],
        /**
         * Overscroll Behavior X
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-x": [{
          "overscroll-x": scaleOverscroll()
        }],
        /**
         * Overscroll Behavior Y
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-y": [{
          "overscroll-y": scaleOverscroll()
        }],
        /**
         * Position
         * @see https://tailwindcss.com/docs/position
         */
        position: ["static", "fixed", "absolute", "relative", "sticky"],
        /**
         * Inset
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        inset: [{
          inset: scaleInset()
        }],
        /**
         * Inset Inline
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-x": [{
          "inset-x": scaleInset()
        }],
        /**
         * Inset Block
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-y": [{
          "inset-y": scaleInset()
        }],
        /**
         * Inset Inline Start
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         * @todo class group will be renamed to `inset-s` in next major release
         */
        start: [{
          "inset-s": scaleInset(),
          /**
           * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
           * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
           */
          start: scaleInset()
        }],
        /**
         * Inset Inline End
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         * @todo class group will be renamed to `inset-e` in next major release
         */
        end: [{
          "inset-e": scaleInset(),
          /**
           * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
           * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
           */
          end: scaleInset()
        }],
        /**
         * Inset Block Start
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-bs": [{
          "inset-bs": scaleInset()
        }],
        /**
         * Inset Block End
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-be": [{
          "inset-be": scaleInset()
        }],
        /**
         * Top
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        top: [{
          top: scaleInset()
        }],
        /**
         * Right
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        right: [{
          right: scaleInset()
        }],
        /**
         * Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        bottom: [{
          bottom: scaleInset()
        }],
        /**
         * Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        left: [{
          left: scaleInset()
        }],
        /**
         * Visibility
         * @see https://tailwindcss.com/docs/visibility
         */
        visibility: ["visible", "invisible", "collapse"],
        /**
         * Z-Index
         * @see https://tailwindcss.com/docs/z-index
         */
        z: [{
          z: [isInteger, "auto", isArbitraryVariable, isArbitraryValue]
        }],
        // ------------------------
        // --- Flexbox and Grid ---
        // ------------------------
        /**
         * Flex Basis
         * @see https://tailwindcss.com/docs/flex-basis
         */
        basis: [{
          basis: [isFraction, "full", "auto", themeContainer, ...scaleUnambiguousSpacing()]
        }],
        /**
         * Flex Direction
         * @see https://tailwindcss.com/docs/flex-direction
         */
        "flex-direction": [{
          flex: ["row", "row-reverse", "col", "col-reverse"]
        }],
        /**
         * Flex Wrap
         * @see https://tailwindcss.com/docs/flex-wrap
         */
        "flex-wrap": [{
          flex: ["nowrap", "wrap", "wrap-reverse"]
        }],
        /**
         * Flex
         * @see https://tailwindcss.com/docs/flex
         */
        flex: [{
          flex: [isNumber, isFraction, "auto", "initial", "none", isArbitraryValue]
        }],
        /**
         * Flex Grow
         * @see https://tailwindcss.com/docs/flex-grow
         */
        grow: [{
          grow: ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Flex Shrink
         * @see https://tailwindcss.com/docs/flex-shrink
         */
        shrink: [{
          shrink: ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Order
         * @see https://tailwindcss.com/docs/order
         */
        order: [{
          order: [isInteger, "first", "last", "none", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Grid Template Columns
         * @see https://tailwindcss.com/docs/grid-template-columns
         */
        "grid-cols": [{
          "grid-cols": scaleGridTemplateColsRows()
        }],
        /**
         * Grid Column Start / End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start-end": [{
          col: scaleGridColRowStartAndEnd()
        }],
        /**
         * Grid Column Start
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start": [{
          "col-start": scaleGridColRowStartOrEnd()
        }],
        /**
         * Grid Column End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-end": [{
          "col-end": scaleGridColRowStartOrEnd()
        }],
        /**
         * Grid Template Rows
         * @see https://tailwindcss.com/docs/grid-template-rows
         */
        "grid-rows": [{
          "grid-rows": scaleGridTemplateColsRows()
        }],
        /**
         * Grid Row Start / End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start-end": [{
          row: scaleGridColRowStartAndEnd()
        }],
        /**
         * Grid Row Start
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start": [{
          "row-start": scaleGridColRowStartOrEnd()
        }],
        /**
         * Grid Row End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-end": [{
          "row-end": scaleGridColRowStartOrEnd()
        }],
        /**
         * Grid Auto Flow
         * @see https://tailwindcss.com/docs/grid-auto-flow
         */
        "grid-flow": [{
          "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
        }],
        /**
         * Grid Auto Columns
         * @see https://tailwindcss.com/docs/grid-auto-columns
         */
        "auto-cols": [{
          "auto-cols": scaleGridAutoColsRows()
        }],
        /**
         * Grid Auto Rows
         * @see https://tailwindcss.com/docs/grid-auto-rows
         */
        "auto-rows": [{
          "auto-rows": scaleGridAutoColsRows()
        }],
        /**
         * Gap
         * @see https://tailwindcss.com/docs/gap
         */
        gap: [{
          gap: scaleUnambiguousSpacing()
        }],
        /**
         * Gap X
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-x": [{
          "gap-x": scaleUnambiguousSpacing()
        }],
        /**
         * Gap Y
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-y": [{
          "gap-y": scaleUnambiguousSpacing()
        }],
        /**
         * Justify Content
         * @see https://tailwindcss.com/docs/justify-content
         */
        "justify-content": [{
          justify: [...scaleAlignPrimaryAxis(), "normal"]
        }],
        /**
         * Justify Items
         * @see https://tailwindcss.com/docs/justify-items
         */
        "justify-items": [{
          "justify-items": [...scaleAlignSecondaryAxis(), "normal"]
        }],
        /**
         * Justify Self
         * @see https://tailwindcss.com/docs/justify-self
         */
        "justify-self": [{
          "justify-self": ["auto", ...scaleAlignSecondaryAxis()]
        }],
        /**
         * Align Content
         * @see https://tailwindcss.com/docs/align-content
         */
        "align-content": [{
          content: ["normal", ...scaleAlignPrimaryAxis()]
        }],
        /**
         * Align Items
         * @see https://tailwindcss.com/docs/align-items
         */
        "align-items": [{
          items: [...scaleAlignSecondaryAxis(), {
            baseline: ["", "last"]
          }]
        }],
        /**
         * Align Self
         * @see https://tailwindcss.com/docs/align-self
         */
        "align-self": [{
          self: ["auto", ...scaleAlignSecondaryAxis(), {
            baseline: ["", "last"]
          }]
        }],
        /**
         * Place Content
         * @see https://tailwindcss.com/docs/place-content
         */
        "place-content": [{
          "place-content": scaleAlignPrimaryAxis()
        }],
        /**
         * Place Items
         * @see https://tailwindcss.com/docs/place-items
         */
        "place-items": [{
          "place-items": [...scaleAlignSecondaryAxis(), "baseline"]
        }],
        /**
         * Place Self
         * @see https://tailwindcss.com/docs/place-self
         */
        "place-self": [{
          "place-self": ["auto", ...scaleAlignSecondaryAxis()]
        }],
        // Spacing
        /**
         * Padding
         * @see https://tailwindcss.com/docs/padding
         */
        p: [{
          p: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Inline
         * @see https://tailwindcss.com/docs/padding
         */
        px: [{
          px: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Block
         * @see https://tailwindcss.com/docs/padding
         */
        py: [{
          py: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Inline Start
         * @see https://tailwindcss.com/docs/padding
         */
        ps: [{
          ps: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Inline End
         * @see https://tailwindcss.com/docs/padding
         */
        pe: [{
          pe: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Block Start
         * @see https://tailwindcss.com/docs/padding
         */
        pbs: [{
          pbs: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Block End
         * @see https://tailwindcss.com/docs/padding
         */
        pbe: [{
          pbe: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Top
         * @see https://tailwindcss.com/docs/padding
         */
        pt: [{
          pt: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Right
         * @see https://tailwindcss.com/docs/padding
         */
        pr: [{
          pr: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Bottom
         * @see https://tailwindcss.com/docs/padding
         */
        pb: [{
          pb: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Left
         * @see https://tailwindcss.com/docs/padding
         */
        pl: [{
          pl: scaleUnambiguousSpacing()
        }],
        /**
         * Margin
         * @see https://tailwindcss.com/docs/margin
         */
        m: [{
          m: scaleMargin()
        }],
        /**
         * Margin Inline
         * @see https://tailwindcss.com/docs/margin
         */
        mx: [{
          mx: scaleMargin()
        }],
        /**
         * Margin Block
         * @see https://tailwindcss.com/docs/margin
         */
        my: [{
          my: scaleMargin()
        }],
        /**
         * Margin Inline Start
         * @see https://tailwindcss.com/docs/margin
         */
        ms: [{
          ms: scaleMargin()
        }],
        /**
         * Margin Inline End
         * @see https://tailwindcss.com/docs/margin
         */
        me: [{
          me: scaleMargin()
        }],
        /**
         * Margin Block Start
         * @see https://tailwindcss.com/docs/margin
         */
        mbs: [{
          mbs: scaleMargin()
        }],
        /**
         * Margin Block End
         * @see https://tailwindcss.com/docs/margin
         */
        mbe: [{
          mbe: scaleMargin()
        }],
        /**
         * Margin Top
         * @see https://tailwindcss.com/docs/margin
         */
        mt: [{
          mt: scaleMargin()
        }],
        /**
         * Margin Right
         * @see https://tailwindcss.com/docs/margin
         */
        mr: [{
          mr: scaleMargin()
        }],
        /**
         * Margin Bottom
         * @see https://tailwindcss.com/docs/margin
         */
        mb: [{
          mb: scaleMargin()
        }],
        /**
         * Margin Left
         * @see https://tailwindcss.com/docs/margin
         */
        ml: [{
          ml: scaleMargin()
        }],
        /**
         * Space Between X
         * @see https://tailwindcss.com/docs/margin#adding-space-between-children
         */
        "space-x": [{
          "space-x": scaleUnambiguousSpacing()
        }],
        /**
         * Space Between X Reverse
         * @see https://tailwindcss.com/docs/margin#adding-space-between-children
         */
        "space-x-reverse": ["space-x-reverse"],
        /**
         * Space Between Y
         * @see https://tailwindcss.com/docs/margin#adding-space-between-children
         */
        "space-y": [{
          "space-y": scaleUnambiguousSpacing()
        }],
        /**
         * Space Between Y Reverse
         * @see https://tailwindcss.com/docs/margin#adding-space-between-children
         */
        "space-y-reverse": ["space-y-reverse"],
        // --------------
        // --- Sizing ---
        // --------------
        /**
         * Size
         * @see https://tailwindcss.com/docs/width#setting-both-width-and-height
         */
        size: [{
          size: scaleSizing()
        }],
        /**
         * Inline Size
         * @see https://tailwindcss.com/docs/width
         */
        "inline-size": [{
          inline: ["auto", ...scaleSizingInline()]
        }],
        /**
         * Min-Inline Size
         * @see https://tailwindcss.com/docs/min-width
         */
        "min-inline-size": [{
          "min-inline": ["auto", ...scaleSizingInline()]
        }],
        /**
         * Max-Inline Size
         * @see https://tailwindcss.com/docs/max-width
         */
        "max-inline-size": [{
          "max-inline": ["none", ...scaleSizingInline()]
        }],
        /**
         * Block Size
         * @see https://tailwindcss.com/docs/height
         */
        "block-size": [{
          block: ["auto", ...scaleSizingBlock()]
        }],
        /**
         * Min-Block Size
         * @see https://tailwindcss.com/docs/min-height
         */
        "min-block-size": [{
          "min-block": ["auto", ...scaleSizingBlock()]
        }],
        /**
         * Max-Block Size
         * @see https://tailwindcss.com/docs/max-height
         */
        "max-block-size": [{
          "max-block": ["none", ...scaleSizingBlock()]
        }],
        /**
         * Width
         * @see https://tailwindcss.com/docs/width
         */
        w: [{
          w: [themeContainer, "screen", ...scaleSizing()]
        }],
        /**
         * Min-Width
         * @see https://tailwindcss.com/docs/min-width
         */
        "min-w": [{
          "min-w": [
            themeContainer,
            "screen",
            /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
            "none",
            ...scaleSizing()
          ]
        }],
        /**
         * Max-Width
         * @see https://tailwindcss.com/docs/max-width
         */
        "max-w": [{
          "max-w": [
            themeContainer,
            "screen",
            "none",
            /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
            "prose",
            /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
            {
              screen: [themeBreakpoint]
            },
            ...scaleSizing()
          ]
        }],
        /**
         * Height
         * @see https://tailwindcss.com/docs/height
         */
        h: [{
          h: ["screen", "lh", ...scaleSizing()]
        }],
        /**
         * Min-Height
         * @see https://tailwindcss.com/docs/min-height
         */
        "min-h": [{
          "min-h": ["screen", "lh", "none", ...scaleSizing()]
        }],
        /**
         * Max-Height
         * @see https://tailwindcss.com/docs/max-height
         */
        "max-h": [{
          "max-h": ["screen", "lh", ...scaleSizing()]
        }],
        // ------------------
        // --- Typography ---
        // ------------------
        /**
         * Font Size
         * @see https://tailwindcss.com/docs/font-size
         */
        "font-size": [{
          text: ["base", themeText, isArbitraryVariableLength, isArbitraryLength]
        }],
        /**
         * Font Smoothing
         * @see https://tailwindcss.com/docs/font-smoothing
         */
        "font-smoothing": ["antialiased", "subpixel-antialiased"],
        /**
         * Font Style
         * @see https://tailwindcss.com/docs/font-style
         */
        "font-style": ["italic", "not-italic"],
        /**
         * Font Weight
         * @see https://tailwindcss.com/docs/font-weight
         */
        "font-weight": [{
          font: [themeFontWeight, isArbitraryVariableWeight, isArbitraryWeight]
        }],
        /**
         * Font Stretch
         * @see https://tailwindcss.com/docs/font-stretch
         */
        "font-stretch": [{
          "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", isPercent, isArbitraryValue]
        }],
        /**
         * Font Family
         * @see https://tailwindcss.com/docs/font-family
         */
        "font-family": [{
          font: [isArbitraryVariableFamilyName, isArbitraryFamilyName, themeFont]
        }],
        /**
         * Font Feature Settings
         * @see https://tailwindcss.com/docs/font-feature-settings
         */
        "font-features": [{
          "font-features": [isArbitraryValue]
        }],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-normal": ["normal-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-ordinal": ["ordinal"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-slashed-zero": ["slashed-zero"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-figure": ["lining-nums", "oldstyle-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-spacing": ["proportional-nums", "tabular-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
        /**
         * Letter Spacing
         * @see https://tailwindcss.com/docs/letter-spacing
         */
        tracking: [{
          tracking: [themeTracking, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Line Clamp
         * @see https://tailwindcss.com/docs/line-clamp
         */
        "line-clamp": [{
          "line-clamp": [isNumber, "none", isArbitraryVariable, isArbitraryNumber]
        }],
        /**
         * Line Height
         * @see https://tailwindcss.com/docs/line-height
         */
        leading: [{
          leading: [
            /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
            themeLeading,
            ...scaleUnambiguousSpacing()
          ]
        }],
        /**
         * List Style Image
         * @see https://tailwindcss.com/docs/list-style-image
         */
        "list-image": [{
          "list-image": ["none", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * List Style Position
         * @see https://tailwindcss.com/docs/list-style-position
         */
        "list-style-position": [{
          list: ["inside", "outside"]
        }],
        /**
         * List Style Type
         * @see https://tailwindcss.com/docs/list-style-type
         */
        "list-style-type": [{
          list: ["disc", "decimal", "none", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Text Alignment
         * @see https://tailwindcss.com/docs/text-align
         */
        "text-alignment": [{
          text: ["left", "center", "right", "justify", "start", "end"]
        }],
        /**
         * Placeholder Color
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://v3.tailwindcss.com/docs/placeholder-color
         */
        "placeholder-color": [{
          placeholder: scaleColor()
        }],
        /**
         * Text Color
         * @see https://tailwindcss.com/docs/text-color
         */
        "text-color": [{
          text: scaleColor()
        }],
        /**
         * Text Decoration
         * @see https://tailwindcss.com/docs/text-decoration
         */
        "text-decoration": ["underline", "overline", "line-through", "no-underline"],
        /**
         * Text Decoration Style
         * @see https://tailwindcss.com/docs/text-decoration-style
         */
        "text-decoration-style": [{
          decoration: [...scaleLineStyle(), "wavy"]
        }],
        /**
         * Text Decoration Thickness
         * @see https://tailwindcss.com/docs/text-decoration-thickness
         */
        "text-decoration-thickness": [{
          decoration: [isNumber, "from-font", "auto", isArbitraryVariable, isArbitraryLength]
        }],
        /**
         * Text Decoration Color
         * @see https://tailwindcss.com/docs/text-decoration-color
         */
        "text-decoration-color": [{
          decoration: scaleColor()
        }],
        /**
         * Text Underline Offset
         * @see https://tailwindcss.com/docs/text-underline-offset
         */
        "underline-offset": [{
          "underline-offset": [isNumber, "auto", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Text Transform
         * @see https://tailwindcss.com/docs/text-transform
         */
        "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
        /**
         * Text Overflow
         * @see https://tailwindcss.com/docs/text-overflow
         */
        "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
        /**
         * Text Wrap
         * @see https://tailwindcss.com/docs/text-wrap
         */
        "text-wrap": [{
          text: ["wrap", "nowrap", "balance", "pretty"]
        }],
        /**
         * Text Indent
         * @see https://tailwindcss.com/docs/text-indent
         */
        indent: [{
          indent: scaleUnambiguousSpacing()
        }],
        /**
         * Tab Size
         * @see https://tailwindcss.com/docs/tab-size
         */
        "tab-size": [{
          tab: [isInteger, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Vertical Alignment
         * @see https://tailwindcss.com/docs/vertical-align
         */
        "vertical-align": [{
          align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Whitespace
         * @see https://tailwindcss.com/docs/whitespace
         */
        whitespace: [{
          whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
        }],
        /**
         * Word Break
         * @see https://tailwindcss.com/docs/word-break
         */
        break: [{
          break: ["normal", "words", "all", "keep"]
        }],
        /**
         * Overflow Wrap
         * @see https://tailwindcss.com/docs/overflow-wrap
         */
        wrap: [{
          wrap: ["break-word", "anywhere", "normal"]
        }],
        /**
         * Hyphens
         * @see https://tailwindcss.com/docs/hyphens
         */
        hyphens: [{
          hyphens: ["none", "manual", "auto"]
        }],
        /**
         * Content
         * @see https://tailwindcss.com/docs/content
         */
        content: [{
          content: ["none", isArbitraryVariable, isArbitraryValue]
        }],
        // -------------------
        // --- Backgrounds ---
        // -------------------
        /**
         * Background Attachment
         * @see https://tailwindcss.com/docs/background-attachment
         */
        "bg-attachment": [{
          bg: ["fixed", "local", "scroll"]
        }],
        /**
         * Background Clip
         * @see https://tailwindcss.com/docs/background-clip
         */
        "bg-clip": [{
          "bg-clip": ["border", "padding", "content", "text"]
        }],
        /**
         * Background Origin
         * @see https://tailwindcss.com/docs/background-origin
         */
        "bg-origin": [{
          "bg-origin": ["border", "padding", "content"]
        }],
        /**
         * Background Position
         * @see https://tailwindcss.com/docs/background-position
         */
        "bg-position": [{
          bg: scaleBgPosition()
        }],
        /**
         * Background Repeat
         * @see https://tailwindcss.com/docs/background-repeat
         */
        "bg-repeat": [{
          bg: scaleBgRepeat()
        }],
        /**
         * Background Size
         * @see https://tailwindcss.com/docs/background-size
         */
        "bg-size": [{
          bg: scaleBgSize()
        }],
        /**
         * Background Image
         * @see https://tailwindcss.com/docs/background-image
         */
        "bg-image": [{
          bg: ["none", {
            linear: [{
              to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
            }, isInteger, isArbitraryVariable, isArbitraryValue],
            radial: ["", isArbitraryVariable, isArbitraryValue],
            conic: [isInteger, isArbitraryVariable, isArbitraryValue]
          }, isArbitraryVariableImage, isArbitraryImage]
        }],
        /**
         * Background Color
         * @see https://tailwindcss.com/docs/background-color
         */
        "bg-color": [{
          bg: scaleColor()
        }],
        /**
         * Gradient Color Stops From Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from-pos": [{
          from: scaleGradientStopPosition()
        }],
        /**
         * Gradient Color Stops Via Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via-pos": [{
          via: scaleGradientStopPosition()
        }],
        /**
         * Gradient Color Stops To Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to-pos": [{
          to: scaleGradientStopPosition()
        }],
        /**
         * Gradient Color Stops From
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from": [{
          from: scaleColor()
        }],
        /**
         * Gradient Color Stops Via
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via": [{
          via: scaleColor()
        }],
        /**
         * Gradient Color Stops To
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to": [{
          to: scaleColor()
        }],
        // ---------------
        // --- Borders ---
        // ---------------
        /**
         * Border Radius
         * @see https://tailwindcss.com/docs/border-radius
         */
        rounded: [{
          rounded: scaleRadius()
        }],
        /**
         * Border Radius Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-s": [{
          "rounded-s": scaleRadius()
        }],
        /**
         * Border Radius End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-e": [{
          "rounded-e": scaleRadius()
        }],
        /**
         * Border Radius Top
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-t": [{
          "rounded-t": scaleRadius()
        }],
        /**
         * Border Radius Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-r": [{
          "rounded-r": scaleRadius()
        }],
        /**
         * Border Radius Bottom
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-b": [{
          "rounded-b": scaleRadius()
        }],
        /**
         * Border Radius Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-l": [{
          "rounded-l": scaleRadius()
        }],
        /**
         * Border Radius Start Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ss": [{
          "rounded-ss": scaleRadius()
        }],
        /**
         * Border Radius Start End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-se": [{
          "rounded-se": scaleRadius()
        }],
        /**
         * Border Radius End End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ee": [{
          "rounded-ee": scaleRadius()
        }],
        /**
         * Border Radius End Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-es": [{
          "rounded-es": scaleRadius()
        }],
        /**
         * Border Radius Top Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tl": [{
          "rounded-tl": scaleRadius()
        }],
        /**
         * Border Radius Top Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tr": [{
          "rounded-tr": scaleRadius()
        }],
        /**
         * Border Radius Bottom Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-br": [{
          "rounded-br": scaleRadius()
        }],
        /**
         * Border Radius Bottom Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-bl": [{
          "rounded-bl": scaleRadius()
        }],
        /**
         * Border Width
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w": [{
          border: scaleBorderWidth()
        }],
        /**
         * Border Width Inline
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-x": [{
          "border-x": scaleBorderWidth()
        }],
        /**
         * Border Width Block
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-y": [{
          "border-y": scaleBorderWidth()
        }],
        /**
         * Border Width Inline Start
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-s": [{
          "border-s": scaleBorderWidth()
        }],
        /**
         * Border Width Inline End
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-e": [{
          "border-e": scaleBorderWidth()
        }],
        /**
         * Border Width Block Start
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-bs": [{
          "border-bs": scaleBorderWidth()
        }],
        /**
         * Border Width Block End
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-be": [{
          "border-be": scaleBorderWidth()
        }],
        /**
         * Border Width Top
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-t": [{
          "border-t": scaleBorderWidth()
        }],
        /**
         * Border Width Right
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-r": [{
          "border-r": scaleBorderWidth()
        }],
        /**
         * Border Width Bottom
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-b": [{
          "border-b": scaleBorderWidth()
        }],
        /**
         * Border Width Left
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-l": [{
          "border-l": scaleBorderWidth()
        }],
        /**
         * Divide Width X
         * @see https://tailwindcss.com/docs/border-width#between-children
         */
        "divide-x": [{
          "divide-x": scaleBorderWidth()
        }],
        /**
         * Divide Width X Reverse
         * @see https://tailwindcss.com/docs/border-width#between-children
         */
        "divide-x-reverse": ["divide-x-reverse"],
        /**
         * Divide Width Y
         * @see https://tailwindcss.com/docs/border-width#between-children
         */
        "divide-y": [{
          "divide-y": scaleBorderWidth()
        }],
        /**
         * Divide Width Y Reverse
         * @see https://tailwindcss.com/docs/border-width#between-children
         */
        "divide-y-reverse": ["divide-y-reverse"],
        /**
         * Border Style
         * @see https://tailwindcss.com/docs/border-style
         */
        "border-style": [{
          border: [...scaleLineStyle(), "hidden", "none"]
        }],
        /**
         * Divide Style
         * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
         */
        "divide-style": [{
          divide: [...scaleLineStyle(), "hidden", "none"]
        }],
        /**
         * Border Color
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color": [{
          border: scaleColor()
        }],
        /**
         * Border Color Inline
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-x": [{
          "border-x": scaleColor()
        }],
        /**
         * Border Color Block
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-y": [{
          "border-y": scaleColor()
        }],
        /**
         * Border Color Inline Start
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-s": [{
          "border-s": scaleColor()
        }],
        /**
         * Border Color Inline End
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-e": [{
          "border-e": scaleColor()
        }],
        /**
         * Border Color Block Start
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-bs": [{
          "border-bs": scaleColor()
        }],
        /**
         * Border Color Block End
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-be": [{
          "border-be": scaleColor()
        }],
        /**
         * Border Color Top
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-t": [{
          "border-t": scaleColor()
        }],
        /**
         * Border Color Right
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-r": [{
          "border-r": scaleColor()
        }],
        /**
         * Border Color Bottom
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-b": [{
          "border-b": scaleColor()
        }],
        /**
         * Border Color Left
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-l": [{
          "border-l": scaleColor()
        }],
        /**
         * Divide Color
         * @see https://tailwindcss.com/docs/divide-color
         */
        "divide-color": [{
          divide: scaleColor()
        }],
        /**
         * Outline Style
         * @see https://tailwindcss.com/docs/outline-style
         */
        "outline-style": [{
          outline: [...scaleLineStyle(), "none", "hidden"]
        }],
        /**
         * Outline Offset
         * @see https://tailwindcss.com/docs/outline-offset
         */
        "outline-offset": [{
          "outline-offset": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Outline Width
         * @see https://tailwindcss.com/docs/outline-width
         */
        "outline-w": [{
          outline: ["", isNumber, isArbitraryVariableLength, isArbitraryLength]
        }],
        /**
         * Outline Color
         * @see https://tailwindcss.com/docs/outline-color
         */
        "outline-color": [{
          outline: scaleColor()
        }],
        // ---------------
        // --- Effects ---
        // ---------------
        /**
         * Box Shadow
         * @see https://tailwindcss.com/docs/box-shadow
         */
        shadow: [{
          shadow: [
            // Deprecated since Tailwind CSS v4.0.0
            "",
            "none",
            themeShadow,
            isArbitraryVariableShadow,
            isArbitraryShadow
          ]
        }],
        /**
         * Box Shadow Color
         * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
         */
        "shadow-color": [{
          shadow: scaleColor()
        }],
        /**
         * Inset Box Shadow
         * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
         */
        "inset-shadow": [{
          "inset-shadow": ["none", themeInsetShadow, isArbitraryVariableShadow, isArbitraryShadow]
        }],
        /**
         * Inset Box Shadow Color
         * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
         */
        "inset-shadow-color": [{
          "inset-shadow": scaleColor()
        }],
        /**
         * Ring Width
         * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
         */
        "ring-w": [{
          ring: scaleBorderWidth()
        }],
        /**
         * Ring Width Inset
         * @see https://v3.tailwindcss.com/docs/ring-width#inset-rings
         * @deprecated since Tailwind CSS v4.0.0
         * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
         */
        "ring-w-inset": ["ring-inset"],
        /**
         * Ring Color
         * @see https://tailwindcss.com/docs/box-shadow#setting-the-ring-color
         */
        "ring-color": [{
          ring: scaleColor()
        }],
        /**
         * Ring Offset Width
         * @see https://v3.tailwindcss.com/docs/ring-offset-width
         * @deprecated since Tailwind CSS v4.0.0
         * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
         */
        "ring-offset-w": [{
          "ring-offset": [isNumber, isArbitraryLength]
        }],
        /**
         * Ring Offset Color
         * @see https://v3.tailwindcss.com/docs/ring-offset-color
         * @deprecated since Tailwind CSS v4.0.0
         * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
         */
        "ring-offset-color": [{
          "ring-offset": scaleColor()
        }],
        /**
         * Inset Ring Width
         * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
         */
        "inset-ring-w": [{
          "inset-ring": scaleBorderWidth()
        }],
        /**
         * Inset Ring Color
         * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
         */
        "inset-ring-color": [{
          "inset-ring": scaleColor()
        }],
        /**
         * Text Shadow
         * @see https://tailwindcss.com/docs/text-shadow
         */
        "text-shadow": [{
          "text-shadow": ["none", themeTextShadow, isArbitraryVariableShadow, isArbitraryShadow]
        }],
        /**
         * Text Shadow Color
         * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
         */
        "text-shadow-color": [{
          "text-shadow": scaleColor()
        }],
        /**
         * Opacity
         * @see https://tailwindcss.com/docs/opacity
         */
        opacity: [{
          opacity: [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Mix Blend Mode
         * @see https://tailwindcss.com/docs/mix-blend-mode
         */
        "mix-blend": [{
          "mix-blend": [...scaleBlendMode(), "plus-darker", "plus-lighter"]
        }],
        /**
         * Background Blend Mode
         * @see https://tailwindcss.com/docs/background-blend-mode
         */
        "bg-blend": [{
          "bg-blend": scaleBlendMode()
        }],
        /**
         * Mask Clip
         * @see https://tailwindcss.com/docs/mask-clip
         */
        "mask-clip": [{
          "mask-clip": ["border", "padding", "content", "fill", "stroke", "view"]
        }, "mask-no-clip"],
        /**
         * Mask Composite
         * @see https://tailwindcss.com/docs/mask-composite
         */
        "mask-composite": [{
          mask: ["add", "subtract", "intersect", "exclude"]
        }],
        /**
         * Mask Image
         * @see https://tailwindcss.com/docs/mask-image
         */
        "mask-image-linear-pos": [{
          "mask-linear": [isNumber]
        }],
        "mask-image-linear-from-pos": [{
          "mask-linear-from": scaleMaskImagePosition()
        }],
        "mask-image-linear-to-pos": [{
          "mask-linear-to": scaleMaskImagePosition()
        }],
        "mask-image-linear-from-color": [{
          "mask-linear-from": scaleColor()
        }],
        "mask-image-linear-to-color": [{
          "mask-linear-to": scaleColor()
        }],
        "mask-image-t-from-pos": [{
          "mask-t-from": scaleMaskImagePosition()
        }],
        "mask-image-t-to-pos": [{
          "mask-t-to": scaleMaskImagePosition()
        }],
        "mask-image-t-from-color": [{
          "mask-t-from": scaleColor()
        }],
        "mask-image-t-to-color": [{
          "mask-t-to": scaleColor()
        }],
        "mask-image-r-from-pos": [{
          "mask-r-from": scaleMaskImagePosition()
        }],
        "mask-image-r-to-pos": [{
          "mask-r-to": scaleMaskImagePosition()
        }],
        "mask-image-r-from-color": [{
          "mask-r-from": scaleColor()
        }],
        "mask-image-r-to-color": [{
          "mask-r-to": scaleColor()
        }],
        "mask-image-b-from-pos": [{
          "mask-b-from": scaleMaskImagePosition()
        }],
        "mask-image-b-to-pos": [{
          "mask-b-to": scaleMaskImagePosition()
        }],
        "mask-image-b-from-color": [{
          "mask-b-from": scaleColor()
        }],
        "mask-image-b-to-color": [{
          "mask-b-to": scaleColor()
        }],
        "mask-image-l-from-pos": [{
          "mask-l-from": scaleMaskImagePosition()
        }],
        "mask-image-l-to-pos": [{
          "mask-l-to": scaleMaskImagePosition()
        }],
        "mask-image-l-from-color": [{
          "mask-l-from": scaleColor()
        }],
        "mask-image-l-to-color": [{
          "mask-l-to": scaleColor()
        }],
        "mask-image-x-from-pos": [{
          "mask-x-from": scaleMaskImagePosition()
        }],
        "mask-image-x-to-pos": [{
          "mask-x-to": scaleMaskImagePosition()
        }],
        "mask-image-x-from-color": [{
          "mask-x-from": scaleColor()
        }],
        "mask-image-x-to-color": [{
          "mask-x-to": scaleColor()
        }],
        "mask-image-y-from-pos": [{
          "mask-y-from": scaleMaskImagePosition()
        }],
        "mask-image-y-to-pos": [{
          "mask-y-to": scaleMaskImagePosition()
        }],
        "mask-image-y-from-color": [{
          "mask-y-from": scaleColor()
        }],
        "mask-image-y-to-color": [{
          "mask-y-to": scaleColor()
        }],
        "mask-image-radial": [{
          "mask-radial": [isArbitraryVariable, isArbitraryValue]
        }],
        "mask-image-radial-from-pos": [{
          "mask-radial-from": scaleMaskImagePosition()
        }],
        "mask-image-radial-to-pos": [{
          "mask-radial-to": scaleMaskImagePosition()
        }],
        "mask-image-radial-from-color": [{
          "mask-radial-from": scaleColor()
        }],
        "mask-image-radial-to-color": [{
          "mask-radial-to": scaleColor()
        }],
        "mask-image-radial-shape": [{
          "mask-radial": ["circle", "ellipse"]
        }],
        "mask-image-radial-size": [{
          "mask-radial": [{
            closest: ["side", "corner"],
            farthest: ["side", "corner"]
          }]
        }],
        "mask-image-radial-pos": [{
          "mask-radial-at": scalePosition()
        }],
        "mask-image-conic-pos": [{
          "mask-conic": [isNumber]
        }],
        "mask-image-conic-from-pos": [{
          "mask-conic-from": scaleMaskImagePosition()
        }],
        "mask-image-conic-to-pos": [{
          "mask-conic-to": scaleMaskImagePosition()
        }],
        "mask-image-conic-from-color": [{
          "mask-conic-from": scaleColor()
        }],
        "mask-image-conic-to-color": [{
          "mask-conic-to": scaleColor()
        }],
        /**
         * Mask Mode
         * @see https://tailwindcss.com/docs/mask-mode
         */
        "mask-mode": [{
          mask: ["alpha", "luminance", "match"]
        }],
        /**
         * Mask Origin
         * @see https://tailwindcss.com/docs/mask-origin
         */
        "mask-origin": [{
          "mask-origin": ["border", "padding", "content", "fill", "stroke", "view"]
        }],
        /**
         * Mask Position
         * @see https://tailwindcss.com/docs/mask-position
         */
        "mask-position": [{
          mask: scaleBgPosition()
        }],
        /**
         * Mask Repeat
         * @see https://tailwindcss.com/docs/mask-repeat
         */
        "mask-repeat": [{
          mask: scaleBgRepeat()
        }],
        /**
         * Mask Size
         * @see https://tailwindcss.com/docs/mask-size
         */
        "mask-size": [{
          mask: scaleBgSize()
        }],
        /**
         * Mask Type
         * @see https://tailwindcss.com/docs/mask-type
         */
        "mask-type": [{
          "mask-type": ["alpha", "luminance"]
        }],
        /**
         * Mask Image
         * @see https://tailwindcss.com/docs/mask-image
         */
        "mask-image": [{
          mask: ["none", isArbitraryVariable, isArbitraryValue]
        }],
        // ---------------
        // --- Filters ---
        // ---------------
        /**
         * Filter
         * @see https://tailwindcss.com/docs/filter
         */
        filter: [{
          filter: [
            // Deprecated since Tailwind CSS v3.0.0
            "",
            "none",
            isArbitraryVariable,
            isArbitraryValue
          ]
        }],
        /**
         * Blur
         * @see https://tailwindcss.com/docs/blur
         */
        blur: [{
          blur: scaleBlur()
        }],
        /**
         * Brightness
         * @see https://tailwindcss.com/docs/brightness
         */
        brightness: [{
          brightness: [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Contrast
         * @see https://tailwindcss.com/docs/contrast
         */
        contrast: [{
          contrast: [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Drop Shadow
         * @see https://tailwindcss.com/docs/drop-shadow
         */
        "drop-shadow": [{
          "drop-shadow": [
            // Deprecated since Tailwind CSS v4.0.0
            "",
            "none",
            themeDropShadow,
            isArbitraryVariableShadow,
            isArbitraryShadow
          ]
        }],
        /**
         * Drop Shadow Color
         * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
         */
        "drop-shadow-color": [{
          "drop-shadow": scaleColor()
        }],
        /**
         * Grayscale
         * @see https://tailwindcss.com/docs/grayscale
         */
        grayscale: [{
          grayscale: ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Hue Rotate
         * @see https://tailwindcss.com/docs/hue-rotate
         */
        "hue-rotate": [{
          "hue-rotate": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Invert
         * @see https://tailwindcss.com/docs/invert
         */
        invert: [{
          invert: ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Saturate
         * @see https://tailwindcss.com/docs/saturate
         */
        saturate: [{
          saturate: [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Sepia
         * @see https://tailwindcss.com/docs/sepia
         */
        sepia: [{
          sepia: ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Filter
         * @see https://tailwindcss.com/docs/backdrop-filter
         */
        "backdrop-filter": [{
          "backdrop-filter": [
            // Deprecated since Tailwind CSS v3.0.0
            "",
            "none",
            isArbitraryVariable,
            isArbitraryValue
          ]
        }],
        /**
         * Backdrop Blur
         * @see https://tailwindcss.com/docs/backdrop-blur
         */
        "backdrop-blur": [{
          "backdrop-blur": scaleBlur()
        }],
        /**
         * Backdrop Brightness
         * @see https://tailwindcss.com/docs/backdrop-brightness
         */
        "backdrop-brightness": [{
          "backdrop-brightness": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Contrast
         * @see https://tailwindcss.com/docs/backdrop-contrast
         */
        "backdrop-contrast": [{
          "backdrop-contrast": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Grayscale
         * @see https://tailwindcss.com/docs/backdrop-grayscale
         */
        "backdrop-grayscale": [{
          "backdrop-grayscale": ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Hue Rotate
         * @see https://tailwindcss.com/docs/backdrop-hue-rotate
         */
        "backdrop-hue-rotate": [{
          "backdrop-hue-rotate": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Invert
         * @see https://tailwindcss.com/docs/backdrop-invert
         */
        "backdrop-invert": [{
          "backdrop-invert": ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Opacity
         * @see https://tailwindcss.com/docs/backdrop-opacity
         */
        "backdrop-opacity": [{
          "backdrop-opacity": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Saturate
         * @see https://tailwindcss.com/docs/backdrop-saturate
         */
        "backdrop-saturate": [{
          "backdrop-saturate": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Sepia
         * @see https://tailwindcss.com/docs/backdrop-sepia
         */
        "backdrop-sepia": [{
          "backdrop-sepia": ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        // --------------
        // --- Tables ---
        // --------------
        /**
         * Border Collapse
         * @see https://tailwindcss.com/docs/border-collapse
         */
        "border-collapse": [{
          border: ["collapse", "separate"]
        }],
        /**
         * Border Spacing
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing": [{
          "border-spacing": scaleUnambiguousSpacing()
        }],
        /**
         * Border Spacing X
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-x": [{
          "border-spacing-x": scaleUnambiguousSpacing()
        }],
        /**
         * Border Spacing Y
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-y": [{
          "border-spacing-y": scaleUnambiguousSpacing()
        }],
        /**
         * Table Layout
         * @see https://tailwindcss.com/docs/table-layout
         */
        "table-layout": [{
          table: ["auto", "fixed"]
        }],
        /**
         * Caption Side
         * @see https://tailwindcss.com/docs/caption-side
         */
        caption: [{
          caption: ["top", "bottom"]
        }],
        // ---------------------------------
        // --- Transitions and Animation ---
        // ---------------------------------
        /**
         * Transition Property
         * @see https://tailwindcss.com/docs/transition-property
         */
        transition: [{
          transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Transition Behavior
         * @see https://tailwindcss.com/docs/transition-behavior
         */
        "transition-behavior": [{
          transition: ["normal", "discrete"]
        }],
        /**
         * Transition Duration
         * @see https://tailwindcss.com/docs/transition-duration
         */
        duration: [{
          duration: [isNumber, "initial", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Transition Timing Function
         * @see https://tailwindcss.com/docs/transition-timing-function
         */
        ease: [{
          ease: ["linear", "initial", themeEase, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Transition Delay
         * @see https://tailwindcss.com/docs/transition-delay
         */
        delay: [{
          delay: [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Animation
         * @see https://tailwindcss.com/docs/animation
         */
        animate: [{
          animate: ["none", themeAnimate, isArbitraryVariable, isArbitraryValue]
        }],
        // ------------------
        // --- Transforms ---
        // ------------------
        /**
         * Backface Visibility
         * @see https://tailwindcss.com/docs/backface-visibility
         */
        backface: [{
          backface: ["hidden", "visible"]
        }],
        /**
         * Perspective
         * @see https://tailwindcss.com/docs/perspective
         */
        perspective: [{
          perspective: [themePerspective, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Perspective Origin
         * @see https://tailwindcss.com/docs/perspective-origin
         */
        "perspective-origin": [{
          "perspective-origin": scalePositionWithArbitrary()
        }],
        /**
         * Rotate
         * @see https://tailwindcss.com/docs/rotate
         */
        rotate: [{
          rotate: scaleRotate()
        }],
        /**
         * Rotate X
         * @see https://tailwindcss.com/docs/rotate
         */
        "rotate-x": [{
          "rotate-x": scaleRotate()
        }],
        /**
         * Rotate Y
         * @see https://tailwindcss.com/docs/rotate
         */
        "rotate-y": [{
          "rotate-y": scaleRotate()
        }],
        /**
         * Rotate Z
         * @see https://tailwindcss.com/docs/rotate
         */
        "rotate-z": [{
          "rotate-z": scaleRotate()
        }],
        /**
         * Scale
         * @see https://tailwindcss.com/docs/scale
         */
        scale: [{
          scale: scaleScale()
        }],
        /**
         * Scale X
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-x": [{
          "scale-x": scaleScale()
        }],
        /**
         * Scale Y
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-y": [{
          "scale-y": scaleScale()
        }],
        /**
         * Scale Z
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-z": [{
          "scale-z": scaleScale()
        }],
        /**
         * Scale 3D
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-3d": ["scale-3d"],
        /**
         * Skew
         * @see https://tailwindcss.com/docs/skew
         */
        skew: [{
          skew: scaleSkew()
        }],
        /**
         * Skew X
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-x": [{
          "skew-x": scaleSkew()
        }],
        /**
         * Skew Y
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-y": [{
          "skew-y": scaleSkew()
        }],
        /**
         * Transform
         * @see https://tailwindcss.com/docs/transform
         */
        transform: [{
          transform: [isArbitraryVariable, isArbitraryValue, "", "none", "gpu", "cpu"]
        }],
        /**
         * Transform Origin
         * @see https://tailwindcss.com/docs/transform-origin
         */
        "transform-origin": [{
          origin: scalePositionWithArbitrary()
        }],
        /**
         * Transform Style
         * @see https://tailwindcss.com/docs/transform-style
         */
        "transform-style": [{
          transform: ["3d", "flat"]
        }],
        /**
         * Translate
         * @see https://tailwindcss.com/docs/translate
         */
        translate: [{
          translate: scaleTranslate()
        }],
        /**
         * Translate X
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-x": [{
          "translate-x": scaleTranslate()
        }],
        /**
         * Translate Y
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-y": [{
          "translate-y": scaleTranslate()
        }],
        /**
         * Translate Z
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-z": [{
          "translate-z": scaleTranslate()
        }],
        /**
         * Translate None
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-none": ["translate-none"],
        /**
         * Zoom
         * @see https://tailwindcss.com/docs/zoom
         */
        zoom: [{
          zoom: [isInteger, isArbitraryVariable, isArbitraryValue]
        }],
        // ---------------------
        // --- Interactivity ---
        // ---------------------
        /**
         * Accent Color
         * @see https://tailwindcss.com/docs/accent-color
         */
        accent: [{
          accent: scaleColor()
        }],
        /**
         * Appearance
         * @see https://tailwindcss.com/docs/appearance
         */
        appearance: [{
          appearance: ["none", "auto"]
        }],
        /**
         * Caret Color
         * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
         */
        "caret-color": [{
          caret: scaleColor()
        }],
        /**
         * Color Scheme
         * @see https://tailwindcss.com/docs/color-scheme
         */
        "color-scheme": [{
          scheme: ["normal", "dark", "light", "light-dark", "only-dark", "only-light"]
        }],
        /**
         * Cursor
         * @see https://tailwindcss.com/docs/cursor
         */
        cursor: [{
          cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Field Sizing
         * @see https://tailwindcss.com/docs/field-sizing
         */
        "field-sizing": [{
          "field-sizing": ["fixed", "content"]
        }],
        /**
         * Pointer Events
         * @see https://tailwindcss.com/docs/pointer-events
         */
        "pointer-events": [{
          "pointer-events": ["auto", "none"]
        }],
        /**
         * Resize
         * @see https://tailwindcss.com/docs/resize
         */
        resize: [{
          resize: ["none", "", "y", "x"]
        }],
        /**
         * Scroll Behavior
         * @see https://tailwindcss.com/docs/scroll-behavior
         */
        "scroll-behavior": [{
          scroll: ["auto", "smooth"]
        }],
        /**
         * Scrollbar Thumb Color
         * @see https://tailwindcss.com/docs/scrollbar-color
         */
        "scrollbar-thumb-color": [{
          "scrollbar-thumb": scaleColor()
        }],
        /**
         * Scrollbar Track Color
         * @see https://tailwindcss.com/docs/scrollbar-color
         */
        "scrollbar-track-color": [{
          "scrollbar-track": scaleColor()
        }],
        /**
         * Scrollbar Gutter
         * @see https://tailwindcss.com/docs/scrollbar-gutter
         */
        "scrollbar-gutter": [{
          "scrollbar-gutter": ["auto", "stable", "both"]
        }],
        /**
         * Scrollbar Width
         * @see https://tailwindcss.com/docs/scrollbar-width
         */
        "scrollbar-w": [{
          scrollbar: ["auto", "thin", "none"]
        }],
        /**
         * Scroll Margin
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-m": [{
          "scroll-m": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Inline
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mx": [{
          "scroll-mx": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Block
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-my": [{
          "scroll-my": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Inline Start
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ms": [{
          "scroll-ms": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Inline End
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-me": [{
          "scroll-me": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Block Start
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mbs": [{
          "scroll-mbs": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Block End
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mbe": [{
          "scroll-mbe": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Top
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mt": [{
          "scroll-mt": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Right
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mr": [{
          "scroll-mr": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Bottom
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mb": [{
          "scroll-mb": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Left
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ml": [{
          "scroll-ml": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-p": [{
          "scroll-p": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Inline
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-px": [{
          "scroll-px": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Block
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-py": [{
          "scroll-py": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Inline Start
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-ps": [{
          "scroll-ps": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Inline End
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pe": [{
          "scroll-pe": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Block Start
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pbs": [{
          "scroll-pbs": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Block End
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pbe": [{
          "scroll-pbe": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Top
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pt": [{
          "scroll-pt": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Right
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pr": [{
          "scroll-pr": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Bottom
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pb": [{
          "scroll-pb": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Left
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pl": [{
          "scroll-pl": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Snap Align
         * @see https://tailwindcss.com/docs/scroll-snap-align
         */
        "snap-align": [{
          snap: ["start", "end", "center", "align-none"]
        }],
        /**
         * Scroll Snap Stop
         * @see https://tailwindcss.com/docs/scroll-snap-stop
         */
        "snap-stop": [{
          snap: ["normal", "always"]
        }],
        /**
         * Scroll Snap Type
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-type": [{
          snap: ["none", "x", "y", "both"]
        }],
        /**
         * Scroll Snap Type Strictness
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-strictness": [{
          snap: ["mandatory", "proximity"]
        }],
        /**
         * Touch Action
         * @see https://tailwindcss.com/docs/touch-action
         */
        touch: [{
          touch: ["auto", "none", "manipulation"]
        }],
        /**
         * Touch Action X
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-x": [{
          "touch-pan": ["x", "left", "right"]
        }],
        /**
         * Touch Action Y
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-y": [{
          "touch-pan": ["y", "up", "down"]
        }],
        /**
         * Touch Action Pinch Zoom
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-pz": ["touch-pinch-zoom"],
        /**
         * User Select
         * @see https://tailwindcss.com/docs/user-select
         */
        select: [{
          select: ["none", "text", "all", "auto"]
        }],
        /**
         * Will Change
         * @see https://tailwindcss.com/docs/will-change
         */
        "will-change": [{
          "will-change": ["auto", "scroll", "contents", "transform", isArbitraryVariable, isArbitraryValue]
        }],
        // -----------
        // --- SVG ---
        // -----------
        /**
         * Fill
         * @see https://tailwindcss.com/docs/fill
         */
        fill: [{
          fill: ["none", ...scaleColor()]
        }],
        /**
         * Stroke Width
         * @see https://tailwindcss.com/docs/stroke-width
         */
        "stroke-w": [{
          stroke: [isNumber, isArbitraryVariableLength, isArbitraryLength, isArbitraryNumber]
        }],
        /**
         * Stroke
         * @see https://tailwindcss.com/docs/stroke
         */
        stroke: [{
          stroke: ["none", ...scaleColor()]
        }],
        // ---------------------
        // --- Accessibility ---
        // ---------------------
        /**
         * Forced Color Adjust
         * @see https://tailwindcss.com/docs/forced-color-adjust
         */
        "forced-color-adjust": [{
          "forced-color-adjust": ["auto", "none"]
        }]
      },
      conflictingClassGroups: {
        "container-named": ["container-type"],
        overflow: ["overflow-x", "overflow-y"],
        overscroll: ["overscroll-x", "overscroll-y"],
        inset: ["inset-x", "inset-y", "inset-bs", "inset-be", "start", "end", "top", "right", "bottom", "left"],
        "inset-x": ["right", "left"],
        "inset-y": ["top", "bottom"],
        flex: ["basis", "grow", "shrink"],
        gap: ["gap-x", "gap-y"],
        p: ["px", "py", "ps", "pe", "pbs", "pbe", "pt", "pr", "pb", "pl"],
        px: ["pr", "pl"],
        py: ["pt", "pb"],
        m: ["mx", "my", "ms", "me", "mbs", "mbe", "mt", "mr", "mb", "ml"],
        mx: ["mr", "ml"],
        my: ["mt", "mb"],
        size: ["w", "h"],
        "font-size": ["leading"],
        "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
        "fvn-ordinal": ["fvn-normal"],
        "fvn-slashed-zero": ["fvn-normal"],
        "fvn-figure": ["fvn-normal"],
        "fvn-spacing": ["fvn-normal"],
        "fvn-fraction": ["fvn-normal"],
        "line-clamp": ["display", "overflow"],
        rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
        "rounded-s": ["rounded-ss", "rounded-es"],
        "rounded-e": ["rounded-se", "rounded-ee"],
        "rounded-t": ["rounded-tl", "rounded-tr"],
        "rounded-r": ["rounded-tr", "rounded-br"],
        "rounded-b": ["rounded-br", "rounded-bl"],
        "rounded-l": ["rounded-tl", "rounded-bl"],
        "border-spacing": ["border-spacing-x", "border-spacing-y"],
        "border-w": ["border-w-x", "border-w-y", "border-w-s", "border-w-e", "border-w-bs", "border-w-be", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
        "border-w-x": ["border-w-r", "border-w-l"],
        "border-w-y": ["border-w-t", "border-w-b"],
        "border-color": ["border-color-x", "border-color-y", "border-color-s", "border-color-e", "border-color-bs", "border-color-be", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
        "border-color-x": ["border-color-r", "border-color-l"],
        "border-color-y": ["border-color-t", "border-color-b"],
        translate: ["translate-x", "translate-y", "translate-none"],
        "translate-none": ["translate", "translate-x", "translate-y", "translate-z"],
        "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mbs", "scroll-mbe", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
        "scroll-mx": ["scroll-mr", "scroll-ml"],
        "scroll-my": ["scroll-mt", "scroll-mb"],
        "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pbs", "scroll-pbe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
        "scroll-px": ["scroll-pr", "scroll-pl"],
        "scroll-py": ["scroll-pt", "scroll-pb"],
        touch: ["touch-x", "touch-y", "touch-pz"],
        "touch-x": ["touch"],
        "touch-y": ["touch"],
        "touch-pz": ["touch"]
      },
      conflictingClassGroupModifiers: {
        "font-size": ["leading"]
      },
      postfixLookupClassGroups: ["container-type"],
      orderSensitiveModifiers: ["*", "**", "after", "backdrop", "before", "details-content", "file", "first-letter", "first-line", "marker", "placeholder", "selection"]
    };
  };
  var twMerge = /* @__PURE__ */ createTailwindMerge(getDefaultConfig);

  // lib/utils.ts
  function cn(...inputs) {
    return twMerge(clsx(inputs));
  }

  // components/landing/button.tsx
  var import_jsx_runtime = __toESM(require_react_shim());
  var base = "tbl-focus inline-flex items-center gap-1.5 rounded-sm px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] transition-all duration-150 active:translate-y-px";
  var variants = {
    primary: "bg-primary text-primary-foreground hover:brightness-110",
    ink: "bg-foreground text-background hover:bg-primary",
    outline: "border border-foreground/30 text-foreground hover:border-primary hover:text-primary",
    block: "bg-foreground text-background shadow-[4px_4px_0_var(--primary)] hover:shadow-[2px_2px_0_var(--primary)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
  };
  function Button({
    href,
    children,
    variant = "primary",
    icon = ArrowUpRight,
    className
  }) {
    const Icon2 = icon;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", { href, className: cn(base, variants[variant], className), children: [
      children,
      Icon2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon2, { size: 13, strokeWidth: 2, "aria-hidden": true })
    ] });
  }

  // components/landing/badge.tsx
  init_define_import_meta_env();
  var import_jsx_runtime2 = __toESM(require_react_shim());
  var tones = {
    orange: { wrap: "border-primary/40 bg-primary/5 text-accent-foreground", dot: "bg-primary" },
    teal: { wrap: "border-teal/40 bg-teal/10 text-teal", dot: "bg-teal" }
  };
  function Badge({
    children,
    tone = "orange",
    live = false,
    className
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "span",
      {
        className: cn(
          "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]",
          tones[tone].wrap,
          className
        ),
        children: [
          live ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: cn("h-1.5 w-1.5 rounded-full tbl-blink", tones[tone].dot) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-primary", children: "\xA7" }),
          children
        ]
      }
    );
  }

  // components/landing/tag.tsx
  init_define_import_meta_env();
  var import_jsx_runtime3 = __toESM(require_react_shim());
  var tones2 = {
    default: "border-border bg-card text-muted-foreground",
    teal: "border-teal/40 bg-teal/10 text-teal",
    accent: "border-primary/40 bg-primary/5 text-accent-foreground"
  };
  function Tag({
    children,
    tone = "default",
    className
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "span",
      {
        className: cn(
          "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]",
          tones2[tone],
          className
        ),
        children
      }
    );
  }

  // components/landing/overline.tsx
  init_define_import_meta_env();
  var import_jsx_runtime4 = __toESM(require_react_shim());
  function Overline({
    index,
    children,
    className,
    as: Tag2 = "p"
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      Tag2,
      {
        className: cn(
          "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground",
          className
        ),
        children: [
          index && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "text-primary", children: [
            "\xA7 ",
            index
          ] }),
          index && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "px-2 text-border", children: "/" }),
          children
        ]
      }
    );
  }

  // components/landing/wordmark.tsx
  init_define_import_meta_env();
  var import_jsx_runtime5 = __toESM(require_react_shim());
  function Wordmark({
    className,
    stacked = false
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "span",
      {
        className: cn(
          "font-pixel leading-[0.95] tracking-[0.02em]",
          stacked ? "flex flex-col gap-1" : "inline-flex flex-wrap items-baseline gap-x-[0.4em]",
          className
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "zuzuu" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "codes" })
        ]
      }
    );
  }

  // components/landing/grid-cell.tsx
  init_define_import_meta_env();
  var import_jsx_runtime6 = __toESM(require_react_shim());
  function GridCell({
    children,
    className
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        className: cn(
          "tbl-tickhover border-b border-r border-border px-5 py-10 sm:px-8 sm:py-14",
          className
        ),
        children
      }
    );
  }

  // components/landing/section.tsx
  init_define_import_meta_env();

  // components/landing/lead.tsx
  init_define_import_meta_env();
  var import_jsx_runtime7 = __toESM(require_react_shim());
  function Lead({
    size = "intro",
    className,
    children
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "p",
      {
        className: cn(
          "text-pretty font-editorial font-medium",
          size === "manifesto" ? "max-w-4xl text-[1.6rem] leading-[1.22] sm:text-4xl lg:text-5xl" : "max-w-3xl text-2xl leading-snug sm:text-3xl",
          className
        ),
        children
      }
    );
  }

  // components/landing/section.tsx
  var import_jsx_runtime8 = __toESM(require_react_shim());
  function Section({
    id,
    index,
    label,
    lead,
    leadSize = "intro",
    action,
    children,
    className
  }) {
    const hasEyebrow = index !== void 0 || label !== void 0;
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("section", { id, className: cn("border-b border-border pb-20", className), children: [
      hasEyebrow && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "tbl-pad pt-16", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Overline, { index, as: "h2", children: label }) }),
      lead && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: cn("tbl-pad", hasEyebrow ? "pt-6" : "pt-16"), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Lead, { size: leadSize, children: lead }) }),
      children && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "pt-8", children }),
      action && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "tbl-pad pt-8", children: action })
    ] });
  }
  function SectionHeading({
    index,
    label,
    className
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: cn("tbl-pad pt-16", className), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Overline, { index, as: "h2", children: label }) });
  }

  // components/landing/marquee.tsx
  init_define_import_meta_env();
  var import_jsx_runtime9 = __toESM(require_react_shim());
  function Marquee({ items }) {
    const loop = [...items, ...items];
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { "aria-hidden": true, className: "overflow-hidden border-t border-border bg-card/60 py-3", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "tbl-marquee flex w-max gap-8 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/65", children: loop.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "flex items-center gap-8", children: [
      item,
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "text-primary", children: "\u25C7" })
    ] }, i)) }) });
  }

  // components/landing/stat-strip.tsx
  init_define_import_meta_env();
  var import_jsx_runtime10 = __toESM(require_react_shim());
  function StatStrip({ items }) {
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "tbl-bevel grid w-full grid-flow-col auto-cols-fr divide-x divide-border border border-border bg-card sm:inline-flex sm:w-auto", children: items.map((s) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "px-4 py-3 sm:px-5 sm:py-3.5", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "font-display text-xl font-bold tabular-nums tracking-[-0.01em] sm:text-2xl", children: s.value }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground", children: s.label })
    ] }, s.value)) });
  }

  // components/landing/hero.tsx
  init_define_import_meta_env();

  // components/landing/spline-viewer.tsx
  init_define_import_meta_env();
  var import_react4 = __toESM(require_react_shim());
  var import_jsx_runtime11 = __toESM(require_react_shim());
  var VIEWER_SRC = "https://unpkg.com/@splinetool/viewer@1.12.73/build/spline-viewer.js";
  function SplineViewer({
    url,
    className,
    label = "Animated 3D illustration"
  }) {
    const ref = (0, import_react4.useRef)(null);
    const [active, setActive] = (0, import_react4.useState)(false);
    (0, import_react4.useEffect)(() => {
      const el = ref.current;
      if (!el) return;
      const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), {
        rootMargin: "150px"
      });
      io.observe(el);
      return () => io.disconnect();
    }, []);
    (0, import_react4.useEffect)(() => {
      if (!active) return;
      if (!document.querySelector(`script[src*="splinetool"]`)) {
        const script = document.createElement("script");
        script.type = "module";
        script.src = VIEWER_SRC;
        document.head.appendChild(script);
      }
      const tryHide = () => {
        const viewer = document.querySelector("spline-viewer");
        const root = viewer?.shadowRoot;
        if (!root) return false;
        if (!root.querySelector("[data-zuzuu-hide]")) {
          const s = document.createElement("style");
          s.setAttribute("data-zuzuu-hide", "");
          s.textContent = "#logo,a[href*='spline.design']{display:none!important}";
          root.appendChild(s);
        }
        return true;
      };
      if (!tryHide()) {
        const iv = setInterval(() => {
          if (tryHide()) clearInterval(iv);
        }, 200);
        const to = setTimeout(() => clearInterval(iv), 15e3);
        return () => {
          clearInterval(iv);
          clearTimeout(to);
        };
      }
    }, [active]);
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { ref, className: "h-full w-full", children: active && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("spline-viewer", { url, className, "aria-label": label, role: "img" }) });
  }

  // components/landing/hero.tsx
  var import_jsx_runtime12 = __toESM(require_react_shim());
  function Hero({
    badge,
    title,
    subtitle,
    actions,
    stats,
    splineScene
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "tbl-pad relative flex-1 overflow-hidden pt-14 sm:pt-16", children: [
      splineScene && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "pointer-events-none absolute -bottom-8 -right-8 top-0 hidden w-1/2 transform-gpu overflow-hidden [contain:layout_paint] lg:block", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SplineViewer, { url: splineScene, className: "block h-full w-full" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: `tbl-stagger relative ${splineScene ? "max-w-3xl lg:max-w-2xl" : "max-w-3xl"}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Badge, { children: badge }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("h1", { className: "tbl-glitch mt-6 text-balance font-display text-4xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-7xl", children: title }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "mt-6 max-w-xl text-pretty text-base leading-relaxed text-foreground/70 sm:text-lg", children: subtitle }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "mt-8 flex flex-wrap items-center gap-3", children: actions.map((a) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Button, { href: a.href, variant: a.variant, children: a.label }, a.href)) }),
        stats && stats.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "mt-10", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(StatStrip, { items: stats }) })
      ] })
    ] });
  }

  // components/landing/card-grid.tsx
  init_define_import_meta_env();
  var import_jsx_runtime13 = __toESM(require_react_shim());
  var COLS = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4"
  };
  function CardGrid({
    columns = 3,
    variant = "gapped",
    stretch = false,
    className,
    children
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      "div",
      {
        className: cn(
          "grid grid-cols-1",
          COLS[columns],
          variant === "connected" ? "border-t border-l border-border" : "gap-4",
          stretch && "md:items-stretch",
          className
        ),
        children
      }
    );
  }

  // components/landing/step-card.tsx
  init_define_import_meta_env();
  var import_jsx_runtime14 = __toESM(require_react_shim());
  function StepCard({ step, title, body }) {
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(GridCell, { className: "relative", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        "span",
        {
          "aria-hidden": true,
          className: "pointer-events-none absolute right-5 top-4 font-display text-5xl font-bold leading-none text-primary/10",
          children: step
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "font-mono text-[11px] uppercase tracking-[0.2em] text-primary", children: step }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("h3", { className: "mt-4 font-display text-2xl font-bold", children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { className: "mt-3 text-sm leading-relaxed text-muted-foreground", children: body })
    ] });
  }

  // components/landing/ink-cta.tsx
  init_define_import_meta_env();
  var import_image = __toESM(require_image());
  var import_jsx_runtime15 = __toESM(require_react_shim());
  function InkCTA({
    index,
    label,
    title,
    body,
    email
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "section",
      {
        id: "contact",
        className: "tbl-dark tbl-grid tbl-pad relative overflow-hidden bg-background py-24 text-foreground sm:py-32",
        children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "relative flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "relative", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Overline, { index, children: label }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("h2", { className: "tbl-glitch tbl-glitch-soft mt-6 max-w-3xl text-balance font-display text-3xl font-bold leading-[1.05] tracking-[-0.02em] sm:text-5xl", children: title }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "mt-4 max-w-xl text-muted-foreground", children: body }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "mt-8", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
              "a",
              {
                href: `mailto:${email}`,
                className: "tbl-focus inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-primary-foreground transition-all duration-150 hover:brightness-110 active:translate-y-px",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Mail, { size: 14, strokeWidth: 2, "aria-hidden": true }),
                  " ",
                  email
                ]
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "tbl-glitch mt-16 font-pixel text-[clamp(1.6rem,5.4vw,5rem)] leading-[0.9] text-foreground/90", children: "zuzuu codes" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "relative hidden shrink-0 lg:block", "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "tbl-glitch inline-flex overflow-hidden rounded-md border border-border", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            import_image.default,
            {
              src: "/z.png",
              alt: "",
              width: 360,
              height: 360,
              className: "size-56 object-cover xl:size-72"
            }
          ) }) })
        ] })
      }
    );
  }

  // components/landing/point-list.tsx
  init_define_import_meta_env();
  var import_jsx_runtime16 = __toESM(require_react_shim());
  function PointList({
    points
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("ul", { className: "space-y-5", children: points.map((p) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("li", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: "font-display text-base font-bold", children: p.label }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: "mt-1 text-sm leading-relaxed text-muted-foreground", children: p.body })
    ] }, p.label)) });
  }

  // components/landing/tier-card.tsx
  init_define_import_meta_env();
  var import_jsx_runtime17 = __toESM(require_react_shim());
  function TierCard({
    id,
    name,
    outcome,
    price,
    mode,
    forWhom,
    includes,
    involvement,
    cta,
    featured
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
      "div",
      {
        className: cn(
          "relative flex flex-col rounded-sm border border-border p-6 sm:p-7",
          featured ? "tbl-dark tbl-ticks bg-background" : "tbl-bevel bg-card"
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex items-center justify-between gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Overline, { index: id, children: mode }),
            featured && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "rounded-sm bg-primary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-primary-foreground", children: "Recommended" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("h3", { className: "mt-4 font-display text-2xl font-bold tracking-[-0.01em]", children: name }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("p", { className: "mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-primary", children: outcome }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("p", { className: "mt-3 font-display text-lg font-bold tracking-[-0.01em]", children: price }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("p", { className: "mt-3 text-sm leading-relaxed text-muted-foreground", children: forWhom }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "mt-6 flex items-center gap-3 border-t border-border pt-5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground", children: "Our lift" }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "flex gap-1", "aria-hidden": true, children: [1, 2, 3].map((seg) => /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
              "span",
              {
                className: cn(
                  "h-1.5 w-6 rounded-sm",
                  seg <= involvement ? "bg-primary" : "border border-border"
                )
              },
              seg
            )) }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "sr-only", children: [
              "Our lift: ",
              involvement,
              " of 3"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("ul", { className: "mt-6 flex-1 space-y-2.5", children: includes.map((item) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("li", { className: "flex items-start gap-2.5 text-sm leading-relaxed", children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "mt-0.5 text-primary", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Check, { size: 14, strokeWidth: 2.5 }) }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: item })
          ] }, item)) }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            Button,
            {
              href: cta.href,
              variant: featured ? "primary" : id === "01" ? "outline" : "ink",
              className: "mt-8 w-full justify-center",
              children: cta.label
            }
          )
        ]
      }
    );
  }

  // components/landing/comparison-table.tsx
  init_define_import_meta_env();
  var import_jsx_runtime18 = __toESM(require_react_shim());
  function ComparisonTable({
    columns,
    rows,
    caption = "How zuzuu codes compares to the alternatives buyers weigh"
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "tbl-bevel overflow-x-auto rounded-sm border border-border bg-card", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("table", { className: "w-full min-w-[640px] border-collapse text-left", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("caption", { className: "sr-only", children: caption }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("tr", { className: "border-b border-border", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("th", { scope: "col", className: "px-4 py-4", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "sr-only", children: "Criterion" }) }),
        columns.map((col, i) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          "th",
          {
            scope: "col",
            className: cn(
              "px-4 py-4 font-mono text-[11px] uppercase tracking-[0.15em]",
              i === 0 ? "bg-primary/[0.06] font-bold text-primary" : "text-muted-foreground"
            ),
            children: col
          },
          col
        ))
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("tbody", { children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("tr", { className: "border-b border-border last:border-0", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("th", { scope: "row", className: "px-4 py-3.5 text-left text-sm font-medium", children: row.criterion }),
        row.values.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          "td",
          {
            className: cn(
              "px-4 py-3.5 text-sm",
              i === 0 && "bg-primary/[0.06]"
            ),
            children: v === true ? /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Check, { size: 16, strokeWidth: 2.5, className: "text-primary", "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "sr-only", children: "Yes" })
            ] }) : v === false ? /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Minus, { size: 16, strokeWidth: 2, className: "text-muted-foreground/50", "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "sr-only", children: "No" })
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "text-xs text-muted-foreground", children: v })
          },
          i
        ))
      ] }, row.criterion)) })
    ] }) });
  }

  // components/landing/trust-bar.tsx
  init_define_import_meta_env();
  var import_jsx_runtime19 = __toESM(require_react_shim());
  function TrustBar({
    statement,
    badges
  }) {
    return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("section", { className: "border-b border-border bg-card", children: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "tbl-pad flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between", children: [
      statement && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: "max-w-md font-mono text-[11px] uppercase leading-relaxed tracking-[0.15em] text-muted-foreground", children: statement }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "flex flex-wrap gap-x-6 gap-y-2", children: badges.map((b) => /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
        "span",
        {
          className: "flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-foreground/70",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Check, { size: 13, strokeWidth: 2.5, className: "text-primary" }),
            b
          ]
        },
        b
      )) })
    ] }) });
  }
  return __toCommonJS(entry_exports);
})();
/*! Bundled license information:

lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs:
lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs:
lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs:
lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs:
lucide-react/dist/esm/defaultAttributes.mjs:
lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs:
lucide-react/dist/esm/context.mjs:
lucide-react/dist/esm/Icon.mjs:
lucide-react/dist/esm/createLucideIcon.mjs:
lucide-react/dist/esm/icons/arrow-up-right.mjs:
lucide-react/dist/esm/icons/check.mjs:
lucide-react/dist/esm/icons/mail.mjs:
lucide-react/dist/esm/icons/minus.mjs:
lucide-react/dist/esm/lucide-react.mjs:
  (**
   * @license lucide-react v1.21.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
window.ZuzuuDS=ZuzuuDS.__dsMainNs?Object.assign({},ZuzuuDS,ZuzuuDS.__dsMainNs,{__dsMainNs:undefined}):ZuzuuDS;

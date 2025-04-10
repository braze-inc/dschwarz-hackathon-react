/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {getElementDimensions, getNestedBoundingClientRect} from '../utils';

import type {Rect} from '../utils';
import type Agent from 'react-devtools-shared/src/backend/agent';

type Box = {top: number, left: number, width: number, height: number};

const assign = Object.assign;

// Note that the Overlay components are not affected by the active Theme,
// because they highlight elements in the main Chrome window (outside of devtools).
// The colors below were chosen to roughly match those used by Chrome devtools.

class OverlayRect {
  node: HTMLElement;

  constructor(doc: Document, container: HTMLElement) {
    this.node = doc.createElement('div');
    this.node.className = "dschwarz-react-devtools-overlay-rect";

    assign(this.node.style, {
      position: 'fixed',
    });

    container.appendChild(this.node);
  }

  remove() {
    if (this.node.parentNode) {
      this.node.parentNode.removeChild(this.node);
    }
  }

  update(box: Rect, dims: any) {
    assign(this.node.style, {
      height:
        box.height -
        dims.borderTop -
        dims.borderBottom -
        dims.paddingTop -
        dims.paddingBottom +
        'px',
      width:
        box.width -
        dims.borderLeft -
        dims.borderRight -
        dims.paddingLeft -
        dims.paddingRight +
        'px',
    });

    assign(this.node.style, {
      top: box.top - dims.marginTop + 'px',
      left: box.left - dims.marginLeft + 'px',
    });
  }
}

const styleEl = window.document.createElement('style');
styleEl.innerHTML = `
  .dschwarz-react-devtools-overlay {
    z-index: 10000000;
  }
  .dschwarz-react-devtools-overlay:hover {
    z-index: 10000001;
  }
  body:has(.dschwarz-react-devtools-overlay:hover) .dschwarz-react-devtools-overlay:not(:hover) > div {
    opacity: 50%;
  }
  .dschwarz-react-devtools-overlay > div {
    border: 2px solid;
    border-color: rgba(calc(var(--red) * 155 + 100), calc(var(--green) * 155 + 100), calc(var(--blue) * 155 + 100), 0.8);
    pointer-events: none;
  }
  .dschwarz-react-devtools-overlay:hover > div {
    z-index: 10000001;
    border-width: 3px;
    border-style: solid;
  }
  
  .dschwarz-react-devtools-overlay-rect {
    padding: 1px;
    z-index: 9999999;
    background-color: rgba(calc(var(--red) * 255), calc(var(--green) * 255), calc(var(--blue) * 255), 0.1);
  }
  .dschwarz-react-devtools-overlay:hover > .dschwarz-react-devtools-overlay-rect {
    padding: 0px;
  }
  
  .dschwarz-react-devtools-overlay-tip {
    padding: 3px 5px;
    z-index: 10000000;
    display: flex;
    flex-flow: row nowrap;
    background-color: rgba(calc(var(--red) * 50), calc(var(--green) * 50), calc(var(--blue) * 50), 0.8);
    border-radius: 2px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    font-weight: bold;
    position: fixed;
    font-size: 12px;
    white-space: nowrap;
  }
  
  .dschwarz-react-devtools-overlay-tip:hover {
    pointer-events: all;
  }
  .dschwarz-react-devtools-overlay:hover > .dschwarz-react-devtools-overlay-tip {
    padding: 2px 4px;
  }

  /* The switch - the box around the slider */
  .dschwarz-feature-switch {
    pointer-events: all;
    position: relative;
    display: inline-block;
    height: 16px;
    width: 26px;
    margin: 0px;
    margin-left: 4px;
  }
  
  /* Hide default HTML checkbox */
  .dschwarz-feature-switch input {
    opacity: 0;
    width: 0;
    height: 0;
    margin: 0px;
  }
  
  /* The slider */
  .dschwarz-feature-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    -webkit-transition: .2s;
    transition: .2s;
  }
  
  .dschwarz-feature-slider:before {
    position: absolute;
    content: "";
    height: 12px;
    width: 12px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    -webkit-transition: .2s;
    transition: .2s;
  }
  
  input:checked + .dschwarz-feature-slider {
    background-color: #2196F3;
  }
  
  input:focus + .dschwarz-feature-slider {
    box-shadow: 0 0 1px #2196F3;
  }
  
  input:checked + .dschwarz-feature-slider:before {
    -webkit-transform: translateX(10px);
    -ms-transform: translateX(10px);
    transform: translateX(10px);
  }
`;
window.document.head.appendChild(styleEl);

class FeatureToggle {

  container: HTMLElement
  nameSpan: HTMLElement
  input: HTMLElement
  label: HTMLElement
  switchSpan: HTMLElement

  constructor(doc, container) {
    this.container = doc.createElement('div');
    this.label = doc.createElement('label');
    this.switchSpan = doc.createElement('span');
    this.nameSpan = doc.createElement('span');
    this.input = doc.createElement('input');
    this.label.appendChild(this.input);
    this.label.appendChild(this.switchSpan);
    this.container.appendChild(this.nameSpan);
    this.container.appendChild(this.label);
    container.appendChild(this.container);

    this.label.className = 'dschwarz-feature-switch';
    this.input.type = 'checkbox';
    this.switchSpan.className = 'dschwarz-feature-slider';
  }

  update(name: string, value: any) {
    this.input.checked = value;
    this.nameSpan.textContent = name;

    this.input.onchange = (event) => {
      if (window.__SET_FEATURE_FLIPPER__ && window.__CURRENT_FEATURES__) {
        window.__SET_FEATURE_FLIPPER__({
          ...window.__CURRENT_FEATURES__,
          [name]: event.target.checked
        });

        window.highlightAllFeatures();
      }
    }
  }

  remove() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

class OverlayTip {
  tip: HTMLElement;
  nameSpan: HTMLElement;
  featureContainer: HTMLElement;
  document: HTMLElement;

  constructor(doc: Document, container: HTMLElement) {
    this.tip = doc.createElement('div');
    this.tip.className = "dschwarz-react-devtools-overlay-tip";
    this.features = [];
    this.nameSpan = doc.createElement('span');
    this.tip.appendChild(this.nameSpan);
    assign(this.nameSpan.style, {
      color: '#ee78e6',
      borderRight: '1px solid #aaaaaa',
      paddingRight: '0.5rem',
      marginRight: '0.5rem',
      pointerEvents: 'all',
    });
    this.featureContainer = doc.createElement('div');
    this.tip.appendChild(this.featureContainer);
    assign(this.featureContainer.style, {
      color: '#d7d7d7',
    });

    this.document = doc;

    container.appendChild(this.tip);
  }

  remove() {
    if (this.tip.parentNode) {
      this.tip.parentNode.removeChild(this.tip);
    }
    this.features.forEach(f => f.remove());
    this.features.length = 0;
    this.document = null;
  }

  updateText(name: string, width: number, height: number, featureFlags: any) {
    this.nameSpan.textContent = name;

    const featureFlagEntries = featureFlags ? featureFlags.entries().toArray() : [];

    while (this.features.length > featureFlagEntries.length) {
      const feature = this.features.pop();
      feature.remove();
    }

    while (this.features.length < featureFlagEntries.length) {
      const featureElement = new FeatureToggle(this.document, this.featureContainer);
      this.features.push(featureElement);
    }
    featureFlagEntries.forEach(([featureName, featureValue], index) => {
      let latestFeatureValue = window.__CURRENT_FEATURES__?.[featureName];
      if (latestFeatureValue === undefined) {
        latestFeatureValue = featureValue;
      }

      const feature = this.features[index];
      feature.update(featureName, latestFeatureValue);
    });
  }

  show() {
    assign(this.tip.style, {
      display: 'flex'
    });
  }

  hide() {
    assign(this.tip.style, {
      display: 'none'
    });
  }

  updatePosition(dims: Box, bounds: Box) {
    const tipRect = this.tip.getBoundingClientRect();
    const tipPos = findTipPos(dims, bounds, {
      width: tipRect.width,
      height: tipRect.height,
    });
    assign(this.tip.style, tipPos.style);
  }
}

export default class Overlay {
  window: any;
  tipBoundsWindow: any;
  container: HTMLElement;
  tip: OverlayTip;
  rects: Array<OverlayRect>;
  agent: Agent;
  color: string;

  constructor(agent: Agent) {
    // Find the root window, because overlays are positioned relative to it.
    const currentWindow = window.__REACT_DEVTOOLS_TARGET_WINDOW__ || window;
    this.window = currentWindow;


    const red = Math.random();
    const green = Math.random();
    const blue = Math.random();

    const total = red + green + blue;

    // Normalized to add to 1
    this.color = { red: red / total, green: green / total, blue: blue / total }

    // When opened in shells/dev, the tooltip should be bound by the app iframe, not by the topmost window.
    const tipBoundsWindow = window.__REACT_DEVTOOLS_TARGET_WINDOW__ || window;
    this.tipBoundsWindow = tipBoundsWindow;

    const doc = currentWindow.document;
    this.container = doc.createElement('div');
    this.container.className = 'dschwarz-react-devtools-overlay';
    this.container.style = `--red: ${this.color.red};--green: ${this.color.green};--blue: ${this.color.blue};`;

    this.tip = new OverlayTip(doc, this.container);
    this.rects = [];

    this.agent = agent;

    doc.body.appendChild(this.container);
  }

  remove() {
    this.tip.remove();
    this.rects.forEach(rect => {
      rect.remove();
    });
    this.rects.length = 0;
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.elements = null;
  }

  updateOverlayPosition() {
    if (!this.elements) return;

    const outerBox = {
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
      left: Number.POSITIVE_INFINITY,
    };
    this.elements.forEach((element, index) => {
      const box = getNestedBoundingClientRect(element, this.window);
      const dims = getElementDimensions(element);

      outerBox.top = Math.min(outerBox.top, box.top - dims.marginTop);
      outerBox.right = Math.max(
        outerBox.right,
        box.left + box.width + dims.marginRight,
      );
      outerBox.bottom = Math.max(
        outerBox.bottom,
        box.top + box.height + dims.marginBottom,
      );
      outerBox.left = Math.min(outerBox.left, box.left - dims.marginLeft);

      const rect = this.rects[index];
      rect.update(box, dims);
    });

    const tipBounds = getNestedBoundingClientRect(
      this.tipBoundsWindow.document.documentElement,
      this.window,
    );

    const bounds = {
      top: tipBounds.top + this.tipBoundsWindow.scrollY,
      left: tipBounds.left + this.tipBoundsWindow.scrollX,
      height: this.tipBoundsWindow.innerHeight,
      width: this.tipBoundsWindow.innerWidth,
    }

    if (outerBox.top > bounds.top + bounds.height ||
      outerBox.left > bounds.left + bounds.width ||
      outerBox.bottom < bounds.top ||
      outerBox.right < bounds.left) {
      // outside of viewport
      this.tip.hide();
    } else {
      this.tip.show();
      this.tip.updatePosition(
        {
          top: outerBox.top,
          left: outerBox.left,
          height: outerBox.bottom - outerBox.top,
          width: outerBox.right - outerBox.left,
        },
        bounds,
      );
    };
  }

  inspect(nodes: $ReadOnlyArray<HTMLElement>, name?: ?string, featureFlags: any) {
    // We can't get the size of text nodes or comment nodes. React as of v15
    // heavily uses comment nodes to delimit text.
    const elements = nodes.filter(node => node.nodeType === Node.ELEMENT_NODE);
    this.elements = elements;

    while (this.rects.length > elements.length) {
      const rect = this.rects.pop();
      // $FlowFixMe[incompatible-use]
      rect.remove();
    }
    if (elements.length === 0) {
      return;
    }

    while (this.rects.length < elements.length) {
      this.rects.push(new OverlayRect(this.window.document, this.container));
    }

    const outerBox = {
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
      left: Number.POSITIVE_INFINITY,
    };
    elements.forEach((element, index) => {
      const box = getNestedBoundingClientRect(element, this.window);
      const dims = getElementDimensions(element);

      outerBox.top = Math.min(outerBox.top, box.top - dims.marginTop);
      outerBox.right = Math.max(
        outerBox.right,
        box.left + box.width + dims.marginRight,
      );
      outerBox.bottom = Math.max(
        outerBox.bottom,
        box.top + box.height + dims.marginBottom,
      );
      outerBox.left = Math.min(outerBox.left, box.left - dims.marginLeft);

      const rect = this.rects[index];
      rect.update(box, dims);
    });

    if (!name) {
      name = elements[0].nodeName.toLowerCase();

      const node = elements[0];
      const ownerName = this.agent.getComponentNameForHostInstance(node);
      if (ownerName) {
        name += ' (in ' + ownerName + ')';
      }
    }

    this.tip.updateText(
      name,
      outerBox.right - outerBox.left,
      outerBox.bottom - outerBox.top,
      featureFlags,
    );
    const tipBounds = getNestedBoundingClientRect(
      this.tipBoundsWindow.document.documentElement,
      this.window,
    );

    this.tip.updatePosition(
      {
        top: outerBox.top,
        left: outerBox.left,
        height: outerBox.bottom - outerBox.top,
        width: outerBox.right - outerBox.left,
      },
      {
        top: tipBounds.top + this.tipBoundsWindow.scrollY,
        left: tipBounds.left + this.tipBoundsWindow.scrollX,
        height: this.tipBoundsWindow.innerHeight,
        width: this.tipBoundsWindow.innerWidth,
      },
    );
  }
}

function findTipPos(
  dims: Box,
  bounds: Box,
  tipSize: {height: number, width: number},
) {
  const tipHeight = Math.max(tipSize.height, 20);
  const tipWidth = Math.max(tipSize.width, 60);
  const margin = 5;

  let top: number | string;
  if (dims.top + dims.height + tipHeight <= bounds.top + bounds.height) {
    if (dims.top + dims.height < bounds.top + 0) {
      top = bounds.top + margin;
    } else {
      top = dims.top + dims.height + margin;
    }
  } else if (dims.top - tipHeight <= bounds.top + bounds.height) {
    if (dims.top - tipHeight - margin < bounds.top + margin) {
      top = bounds.top + margin;
    } else {
      top = dims.top - tipHeight - margin;
    }
  } else {
    top = bounds.top + bounds.height - tipHeight - margin;
  }

  let left: number | string = dims.left + margin;
  if (dims.left < bounds.left) {
    left = bounds.left + margin;
  }
  if (dims.left + tipWidth > bounds.left + bounds.width) {
    left = bounds.left + bounds.width - tipWidth - margin;
  }

  top += 'px';
  left += 'px';
  return {
    style: {top, left},
  };
}


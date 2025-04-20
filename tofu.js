class Tofu {
  constructor(selector, { chars = '0123456789ABCDEF', intersect = true, click = false, delay = 10, factor = 0.999, debug = false }) {
    this.chars = chars;
    this.delay = delay;
    this.factor = factor;
    this.debug = debug;
    
    this.observer = null;
    this.isResizing = false;
    this.waitingToBeScambled = [];
    this.tofuBlocks = [];
    this.elements = (typeof selector == "string") ? document.querySelectorAll(selector) : selector;
    
    if (this.elements.length === 0) {
      console.warn('No elements found.');
      return false;
    }
    
    this.scrambleAll();
    if (intersect) {
      this.watch();
    }
    
    const rootStyles = getComputedStyle(document.documentElement);
    let isTouch = rootStyles.getPropertyValue('--is-touch') == '1';
    
    if (!isTouch) {
      let resizeTimeout;
      window.addEventListener('resize', async () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = await setTimeout(async () => {
          if (this.isResizing) {
            return;
          }
          this.isResizing = true;
          await this.stop();
          this.resetAll();
          this.scrambleAll();
          this.watch();
          this.isResizing = false;
        }, 200);
      });
    }
  }
  
  async waitUntilAllDescrambled() {
    const wait = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));
    while (this.isBusy()) {
      await wait(200);
      this.log(`⏰ waitUntilAllDescrambled`);
    }
    this.log('✅ waitUntilAllDescrambled');
  }
  
  isBusy() {
    let busy = false;
    for (let t of this.tofuBlocks) {
      busy = busy || (t.el.dataset.tofu == "x");
    }
    return busy;
  }
  
  resetAll() {
    this.tofuBlocks = [];
    this.waitingToBeScambled = [];
    for (let element of this.elements) {
      element.removeAttribute('data-tofu-id');
      element.removeAttribute('data-tofu');
    }
  }
  
  watch() {
    this.observeTofuBlocks(this.tofuBlocks, this.chars, this.delay, this.factor);
  }
  
  observeTofuBlocks(options = {}) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        let block = this.tofuBlocks[entry.target.dataset.tofuId];
        if (entry.isIntersecting) {
          this.waitingToBeScambled[entry.target.dataset.tofuId] = false;
          this.log(`🟢 intesecting ${entry.target.dataset.tofuId}`);
          this.descramble(block); // will be run async (multiple blocks at the same time)
        } else {
          this.waitingToBeScambled[entry.target.dataset.tofuId] = true;
          this.log(`🛑 outersecting ${entry.target.dataset.tofuId}`);
          this.quickScramble(block); // will be run async (multiple blocks at the same time)
        }
      });
    }, options);
    
    this.tofuBlocks.forEach(block => observer.observe(block.el));
    this.observer = observer;
  }
  
  test() {
    for (let t of this.tofuBlocks) {
      this.log(t.el.dataset);
    }
    
  }
  
  async stop() {
    this.observer.disconnect();
    await this.descrambleAll(0);
    await this.waitUntilAllDescrambled();
  }
  
  // SCRAMBLE -----------------------------------------------------------------
  
  scrambleAll() {
    this.tofuBlocks = [];
    let elementID = 0;
    for (let element of this.elements) {
      this.scramble(element, elementID);
      elementID++;
    }
  }
  
  scramble(element, elementID) {
    const getLines = (element) => {
      const text = element.textContent;
      const lines = [];
      const range = document.createRange();
      const node = element.firstChild;
      
      if (!node || node.nodeType !== Node.TEXT_NODE) return [];
      
      let prevTop = null;
      let lineText = '';
      
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        
        const rect = range.getBoundingClientRect();
        
        if (prevTop === null) {
          prevTop = rect.top;
        }
        
        if (rect.top !== prevTop) {
          lines.push(lineText);
          lineText = text[i];
          prevTop = rect.top;
        } else {
          lineText += text[i];
        }
      }
      
      if (lineText.length > 0) {
        lines.push(lineText);
      }
      
      return lines;
    };
    
    const generateRandomString = (length, chars) => {
      let result = '';
      const charsLength = chars.length;
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * charsLength));
      }
      return result;
    };
    
    const getNodeCharacterOffset = (targetEl) => {
      const containerElement = targetEl.parentNode;
      const targetNode = targetEl.firstChild;
      const walker = document.createTreeWalker(
        containerElement,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let offset = 0;
      
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node === targetNode || node.parentNode === targetNode) {
          return [offset, offset + targetNode.textContent.length];
        }
        offset += node.textContent.length;
      }
      
      return -1;
    };
    
    element.innerHTML = element.innerHTML.trim().replaceAll("\n", "").replace(/\s+/g, ' ');
    
    // Get tags and their positions in the text
    let nodesData = [];
    let id = 0;
    for (let childNode of element.querySelectorAll('*')) {
      let data = {};
      [data.start, data.end] = getNodeCharacterOffset(childNode);
      let fontSize = parseInt(window.getComputedStyle(childNode).fontSize);
      let lineHeight = parseInt(window.getComputedStyle(childNode).lineHeight);
      let yPosTop = childNode.getBoundingClientRect().top - childNode.parentNode.getBoundingClientRect().top;
      let yPosBottom = childNode.getBoundingClientRect().bottom - childNode.parentNode.getBoundingClientRect().top;
      data.node = childNode.cloneNode();
      data.lineStart = Math.floor(yPosTop / lineHeight);
      data.lineEnd = Math.floor(yPosBottom / lineHeight);
      data.padding = [];
      data.id = id;
      data.node.innerHTML = '';
      nodesData.push(data);
      id++;
    }
    
    // Remove all tags from text
    element.innerHTML = element.innerText;
    
    // Pad text and created padded random text
    let lines = getLines(element);
    let paddedLines = [];
    let rlines = [];
    let maxLen = Math.max(...lines.map(line => line.length));
    
    let paddings = [0];
    for (let line of lines) {
      paddings.push(paddings[paddings.length - 1] + maxLen - line.length);
      let pLine = line.padEnd(maxLen, " ");
      rlines.push(generateRandomString(maxLen, this.chars));
      paddedLines.push(pLine);
    }
    
    for (let data of nodesData) {
      let dataPadding = [];
      for (let i = 0; i < paddings.length; i++) {
        if (i >= data.lineStart && i <= data.lineEnd) {
          dataPadding.push(paddings[i]);
        }
      }
      data.paddingStart = Math.min(...dataPadding);
      data.paddingEnd = Math.max(...dataPadding);
    }
    
    let text = paddedLines.join("\n");
    let rtext = rlines.join("\n");
    
    // Scramble original text
    element.style.whiteSpace = 'pre';
    element.innerHTML = rtext;
    
    // FIXME: why double here?
    let block = {
      'el': element,
      'text': text,
      'rtext': rtext,
      'nodesData': nodesData,
    };
    
    element.dataset.tofuId = elementID;
    this.tofuBlocks.push(block);
    
    this.applyTags(block);
  }
  
  quickScramble(block) {
    if (!this.waitingToBeScambled[block.el.dataset.tofuId]) {
      this.log(`⛔️ not in queue ${block.el.dataset.tofuId}`)
      return;
    }
    if (block.el.dataset.tofu == "1") {
      return
    }
    if (block.el.dataset.tofu == 'x') {
      this.log(`⏰ quickScramble ${block.el.dataset.tofuId}`);
      setTimeout(() => { this.quickScramble(block); }, 200); // try again in 200ms until scrambled
      return;
    }
    block.el.dataset.tofu = 'x';
    block.el.style.whiteSpace = 'pre';
    block.el.innerText = block.rtext;
    block.el.dataset.tofu = '1';
  }
  
  applyTags(block) {
    for (let nodeData of block.nodesData) {
      const childNodes = block.el.childNodes
      const lastNode = childNodes[childNodes.length - 1];
      const delta = block.text.length - lastNode.length;
      let start = nodeData.start - delta + nodeData.paddingStart + nodeData.lineStart;
      let end = nodeData.end - delta + nodeData.paddingEnd + nodeData.lineEnd
      let range = document.createRange();
      range.setStart(lastNode, start);
      range.setEnd(lastNode, end);
      range.surroundContents(nodeData.node);
    }
  }
  
  // DESCRAMBLE ---------------------------------------------------------------
  
  async descrambleAll(delay = this.delay) {
    for (let block of this.tofuBlocks) {
      await this.descramble(block, delay);
    }
  }
  
  async descramble(block, delay = this.delay) {
    if (block.el.dataset.tofu == '0') {
      return;
    }
    
    if (block.el.dataset.tofu == 'x') {
      this.log(`⏰ decramble ${block.el.dataset.tofuId}`);
      setTimeout(() => { this.descramble(block, delay); }, 200); // try again in 200ms until descrambled
      return;
    }
    
    block.el.dataset.tofu = 'x';
    let descramed = []; // descrambled chars of the block
    let proba = 1; // probability to pick from the block.rtext rather than block.text
    
    await this.descram(block, proba, descramed, delay)
    block.el.style.whiteSpace = '';
    block.el.dataset.tofu = '0';
  }
  
  async descram(block, proba, descramed, delay = this.delay) {
    const wait = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));
    
    const generateRandomChar = () => { return this.chars.charAt(Math.floor(Math.random() * this.chars.length)) };
    
    const flipChars = () => {
      let newText = '';
      for (let i = 0; i < block.text.length; i++) {
        if (descramed[i]) { // skip if this char is already from descrambled
          newText += block.text[i];
          continue;
        }
        let c = Math.random() >= proba;
        if (block.text[i] === "\n") { // newlines are not descrambled, obviously
          newText += "\n";
        } else {
          newText += c ? block.text[i] : generateRandomChar(); // pick from text or rtext...
        }
        if (c) { // mark char as descrambled
          descramed[i] = true;
        }
      }
      return [newText, descramed];
    };
    
    let newText;
    [newText, descramed] = flipChars();
    block.el.innerHTML = newText;
    this.applyTags(block)
    
    proba = proba * (delay == 0 ? 0 : this.factor);
    if (block.text != newText) { // continue as long as we don't have the original text
      if (delay > 0) {
        await wait(delay);
      }
      await this.descram(block, proba, descramed, delay);
    }
  }
  
  // MISC ---------------------------------------------------------------------
  log(msg) {
    if (this.debug) {
      console.log(msg);
    }
  }
}
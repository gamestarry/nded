document.addEventListener('DOMContentLoaded', () => {
  initPoll();
  initAreaModelTutor();
});

function initPoll() {
  const yes = document.querySelector('.question-box .yes');
  const no = document.querySelector('.question-box .no');
  const response = document.getElementById('response');
  if (!yes || !no || !response) return;
  yes.addEventListener('click', () => {
    response.textContent = "That's great! Math is an amazing tool for understanding the world!";
    response.classList.add('show');
  });
  no.addEventListener('click', () => {
    response.textContent = "We're here to help! Our resources are designed to make math easier and more fun.";
    response.classList.add('show');
  });
}

function initAreaModelTutor() {
  const state = { dividend: 0, divisor: 1, remaining: 0, quotient: 0, used: 0, chunks: [], complete: false };
  const els = {
    dividend: document.getElementById('dividend'),
    divisor: document.getElementById('divisor'),
    start: document.getElementById('start'),
    setupMessage: document.getElementById('setup-message'),
    workspace: document.getElementById('workspace'),
    problemText: document.getElementById('problem-text'),
    remainingPill: document.getElementById('remaining-pill'),
    divisorLabel: document.getElementById('divisor-label'),
    model: document.getElementById('area-model'),
    topLabels: document.getElementById('top-labels'),
    quotientTotal: document.getElementById('quotient-total'),
    areaTotal: document.getElementById('area-total'),
    prompt: document.getElementById('prompt'),
    chunkInput: document.getElementById('chunk-input'),
    addChunk: document.getElementById('add-chunk'),
    feedback: document.getElementById('step-feedback'),
    hint: document.getElementById('teacher-hint'),
    help: document.getElementById('help'),
    result: document.getElementById('result-summary')
  };

  const wholePositive = text => /^[1-9]\d*$/.test(text);
  const clearMessage = () => { els.setupMessage.textContent = ''; };

  [els.dividend, els.divisor].forEach(input => input.addEventListener('input', clearMessage));
  els.start.addEventListener('click', startProblem);
  els.addChunk.addEventListener('click', submitChunk);
  els.help.addEventListener('click', showOneStep);
  els.chunkInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') submitChunk();
  });
  els.chunkInput.addEventListener('input', () => {
    els.feedback.textContent = '';
    els.feedback.classList.remove('good');
    els.hint.classList.remove('show');
  });

  function startProblem() {
    const a = els.dividend.value.trim();
    const b = els.divisor.value.trim();

    if (!a || !b) {
      els.setupMessage.textContent = 'Enter both a dividend and a divisor to begin.';
      return;
    }
    if (!wholePositive(a) || !wholePositive(b)) {
      els.setupMessage.textContent = 'Use positive whole numbers for this tutor.';
      return;
    }

    const dividend = Number(a);
    const divisor = Number(b);

    if (!Number.isSafeInteger(dividend) || !Number.isSafeInteger(divisor)) {
      els.setupMessage.textContent = 'Please use smaller whole numbers.';
      return;
    }
    if (dividend > 999999 || divisor > 9999) {
      els.setupMessage.textContent = 'For a clear visual model, use a dividend up to 999,999 and a divisor up to 9,999.';
      return;
    }

    state.dividend = dividend;
    state.divisor = divisor;
    state.remaining = dividend;
    state.quotient = 0;
    state.used = 0;
    state.chunks = [];
    state.complete = false;

    els.workspace.style.display = 'block';
    els.result.classList.remove('show');
    els.result.textContent = '';
    els.feedback.textContent = '';
    els.hint.classList.remove('show');
    els.chunkInput.disabled = false;
    els.addChunk.disabled = false;
    els.help.disabled = false;
    els.chunkInput.value = '';

    render();

    if (state.remaining < state.divisor) {
      finish();
    } else {
      setTimeout(() => els.chunkInput.focus({ preventScroll: true }), 0);
    }
  }

  function suggestedChunk() {
    const max = Math.floor(state.remaining / state.divisor);
    if (max < 1) return 0;
    const friendly = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
    return friendly.find(value => value <= max) || 1;
  }

  function submitChunk() {
    if (state.complete) return;
    const text = els.chunkInput.value.trim();
    if (!wholePositive(text)) {
      showFeedback('Enter a positive whole-number partial quotient, such as 10, 5, 2, or 1.');
      return;
    }
    applyChunk(Number(text), false);
  }

  function applyChunk(chunk, fromHelp) {
    const max = Math.floor(state.remaining / state.divisor);

    if (chunk > max) {
      showFeedback(
        state.divisor + ' × ' + chunk + ' is ' + (state.divisor * chunk) +
        ', which is larger than the ' + state.remaining +
        ' still left. Try a smaller partial quotient.'
      );
      return;
    }

    const area = state.divisor * chunk;
    state.chunks.push({ q: chunk, area: area });
    state.quotient += chunk;
    state.used += area;
    state.remaining -= area;
    els.chunkInput.value = '';

    showFeedback(
      state.divisor + ' × ' + chunk + ' = ' + area +
      '. Great — that rectangle piece uses ' + area + ' of the area.',
      true
    );

    if (fromHelp) {
      els.hint.textContent =
        'I used ' + chunk + ' because ' + state.divisor + ' × ' + chunk +
        ' = ' + area + ', and ' + area + ' fits inside the amount remaining.';
      els.hint.classList.add('show');
    }

    render();

    if (state.remaining < state.divisor) {
      finish();
    } else {
      setTimeout(() => els.chunkInput.focus({ preventScroll: true }), 0);
    }
  }

  function showOneStep() {
    if (state.complete) return;
    const chunk = suggestedChunk();
    if (!chunk) {
      finish();
      return;
    }
    applyChunk(chunk, true);
  }

  function showFeedback(message, good = false) {
    els.feedback.textContent = message;
    els.feedback.classList.toggle('good', good);
  }

  function render() {
    els.problemText.textContent = state.dividend + ' ÷ ' + state.divisor;
    els.remainingPill.textContent = 'Area remaining: ' + state.remaining;
    els.divisorLabel.textContent = 'Divisor = ' + state.divisor;
    els.quotientTotal.textContent = 'Partial quotient total: ' + state.quotient;
    els.areaTotal.textContent = 'Area used: ' + state.used + ' of ' + state.dividend;

    els.prompt.textContent = state.remaining >= state.divisor
      ? 'What multiplication fact with ' + state.divisor +
        ' would make a helpful piece of the ' + state.remaining + ' still remaining?'
      : state.remaining + ' is smaller than ' + state.divisor + ', so no more full groups fit.';

    els.model.replaceChildren();
    els.topLabels.replaceChildren();

    const total = state.dividend;

    state.chunks.forEach(chunk => {
      const width = (chunk.area / total) * 100;

      const seg = document.createElement('div');
      seg.className = 'area-segment';
      seg.style.flex = '0 0 ' + width + '%';
      const label = document.createElement('span');
      label.append(document.createTextNode(String(chunk.area)));
      const small = document.createElement('small');
      small.textContent = state.divisor + ' × ' + chunk.q;
      label.append(small);
      seg.append(label);
      seg.setAttribute('aria-label', state.divisor + ' times ' + chunk.q + ' equals ' + chunk.area);
      els.model.append(seg);

      const top = document.createElement('div');
      top.className = 'top-segment';
      top.style.flex = '0 0 ' + width + '%';
      top.textContent = chunk.q;
      top.title = 'Partial quotient ' + chunk.q;
      els.topLabels.append(top);
    });

    if (state.remaining > 0) {
      const width = (state.remaining / total) * 100;
      const rem = document.createElement('div');
      rem.className = 'uncovered-area' + (state.remaining < state.divisor ? ' remainder' : '');
      rem.style.flex = '0 0 ' + width + '%';
      rem.textContent = state.remaining < state.divisor ? 'R ' + state.remaining : state.remaining + ' left';
      els.model.append(rem);

      const top = document.createElement('div');
      top.className = 'top-segment';
      top.style.flex = '0 0 ' + width + '%';
      els.topLabels.append(top);
    }
  }

  function finish() {
    state.complete = true;
    els.chunkInput.disabled = true;
    els.addChunk.disabled = true;
    els.help.disabled = true;

    const answer = state.remaining === 0
      ? String(state.quotient)
      : state.quotient + ' R' + state.remaining;
    const pieces = state.chunks.map(chunk => chunk.q).join(' + ') || '0';

    els.result.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = state.dividend + ' ÷ ' + state.divisor + ' = ' + answer;
    els.result.append(strong, document.createElement('br'));
    els.result.append(document.createTextNode('Partial quotients: ' + pieces + ' = ' + state.quotient));

    if (state.remaining) {
      els.result.append(document.createElement('br'));
      els.result.append(document.createTextNode(
        state.remaining + ' is the remainder because it is smaller than ' + state.divisor + '.'
      ));
    }

    els.result.classList.add('show');
    els.prompt.textContent = state.remaining
      ? state.remaining + ' is smaller than ' + state.divisor + ', so the model is complete.'
      : 'The whole area has been divided into full groups.';
    els.remainingPill.textContent = state.remaining
      ? 'Remainder: ' + state.remaining
      : 'Area remaining: 0';
  }
}

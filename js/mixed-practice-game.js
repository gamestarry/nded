document.addEventListener('DOMContentLoaded', () => {
    const ROUND_SIZE = 10;

    const answersContainer = document.getElementById('answers-container');
    const equationsContainer = document.getElementById('equations-container');
    const roundStatus = document.getElementById('round-status');
    const roundMessage = document.getElementById('round-message');
    const summary = document.getElementById('round-summary');
    const summaryScore = document.getElementById('summary-score');
    const missedList = document.getElementById('missed-list');
    const nextRoundBtn = document.getElementById('next-round-btn');
    const freshStartBtn = document.getElementById('fresh-start-btn');

    if (!answersContainer || !equationsContainer || !roundStatus || !summary) return;

    const allFacts = [];
    for (let a = 2; a <= 12; a++) {
        for (let b = 1; b <= 12; b++) {
            allFacts.push({
                key: `${a}x${b}`,
                a,
                b,
                result: a * b
            });
        }
    }

    let roundNumber = 1;
    let reviewPool = new Map();
    let currentQuestions = [];
    let currentMissed = new Set();
    let solvedQuestions = new Set();
    let selectedAnswerId = null;
    let draggedAnswerId = null;

    function shuffle(items) {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function chooseRound() {
        const questions = [];
        const reviewFacts = shuffle([...reviewPool.values()]);

        for (const fact of reviewFacts) {
            if (questions.length >= ROUND_SIZE) break;
            questions.push(fact);
        }

        const usedKeys = new Set(questions.map(fact => fact.key));
        const freshFacts = shuffle(allFacts.filter(fact => !usedKeys.has(fact.key)));

        for (const fact of freshFacts) {
            if (questions.length >= ROUND_SIZE) break;
            questions.push(fact);
        }

        return shuffle(questions);
    }

    function clearSelection() {
        selectedAnswerId = null;
        document.querySelectorAll('.mixed-answer.selected').forEach(el => {
            el.classList.remove('selected');
            el.setAttribute('aria-pressed', 'false');
        });
    }

    function updateStatus() {
        roundStatus.textContent = `Round ${roundNumber} · ${solvedQuestions.size}/${ROUND_SIZE} solved`;
    }

    function flashWrong(answerEl, targetEl) {
        if (answerEl) {
            answerEl.classList.remove('wrong');
            void answerEl.offsetWidth;
            answerEl.classList.add('wrong');
            setTimeout(() => answerEl.classList.remove('wrong'), 450);
        }

        if (targetEl) {
            targetEl.classList.remove('wrong');
            void targetEl.offsetWidth;
            targetEl.classList.add('wrong');
            setTimeout(() => targetEl.classList.remove('wrong'), 450);
        }
    }

    function tryAnswer(answerId, questionId) {
        if (!answerId || solvedQuestions.has(questionId)) return;

        const answerEl = document.querySelector(`[data-answer-id="${answerId}"]`);
        const targetEl = document.querySelector(`[data-question-id="${questionId}"] .equation-result`);
        const questionEl = document.querySelector(`[data-question-id="${questionId}"]`);

        if (!answerEl || !targetEl || !questionEl || answerEl.classList.contains('used')) return;

        const answerValue = Number(answerEl.dataset.value);
        const correctValue = Number(questionEl.dataset.result);
        const factKey = questionEl.dataset.factKey;

        if (answerValue !== correctValue) {
            currentMissed.add(factKey);
            roundMessage.textContent = 'Not quite — try that fact again.';
            flashWrong(answerEl, targetEl);
            clearSelection();
            return;
        }

        solvedQuestions.add(questionId);
        answerEl.classList.add('used');
        answerEl.disabled = true;
        targetEl.textContent = String(correctValue);
        targetEl.classList.add('filled');
        targetEl.disabled = true;
        questionEl.classList.add('solved');
        roundMessage.textContent = currentMissed.has(factKey)
            ? 'Nice recovery — keep going!'
            : 'Correct!';

        clearSelection();
        updateStatus();

        if (solvedQuestions.size === ROUND_SIZE) {
            finishRound();
        }
    }

    function makeAnswerCard(question, index) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'answer mixed-answer';
        button.textContent = question.result;
        button.dataset.value = String(question.result);
        button.dataset.answerId = `a-${roundNumber}-${index}`;
        button.setAttribute('aria-label', `Answer ${question.result}`);
        button.setAttribute('aria-pressed', 'false');
        button.draggable = true;

        button.addEventListener('click', () => {
            if (button.classList.contains('used')) return;

            const alreadySelected = selectedAnswerId === button.dataset.answerId;
            clearSelection();

            if (!alreadySelected) {
                selectedAnswerId = button.dataset.answerId;
                button.classList.add('selected');
                button.setAttribute('aria-pressed', 'true');
                roundMessage.textContent = `Selected ${button.textContent}. Now choose a matching equation.`;
            }
        });

        button.addEventListener('dragstart', event => {
            if (button.classList.contains('used')) {
                event.preventDefault();
                return;
            }
            draggedAnswerId = button.dataset.answerId;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', draggedAnswerId);
            button.classList.add('dragging');
        });

        button.addEventListener('dragend', () => {
            draggedAnswerId = null;
            button.classList.remove('dragging');
        });

        return button;
    }

    function makeEquation(question, index) {
        const questionId = `q-${roundNumber}-${index}`;
        const box = document.createElement('div');
        box.className = 'equation mixed-equation';
        box.dataset.questionId = questionId;
        box.dataset.factKey = question.key;
        box.dataset.result = String(question.result);

        const first = document.createElement('div');
        first.className = 'equation-number';
        first.textContent = question.a;

        const text = document.createElement('span');
        text.className = 'mixed-equation-text';
        text.textContent = `× ${question.b} =`;

        const target = document.createElement('button');
        target.type = 'button';
        target.className = 'equation-result';
        target.setAttribute('aria-label', `Answer for ${question.a} times ${question.b}`);

        target.addEventListener('click', () => {
            if (!selectedAnswerId) {
                roundMessage.textContent = 'Choose an answer card first.';
                return;
            }
            tryAnswer(selectedAnswerId, questionId);
        });

        target.addEventListener('dragover', event => {
            event.preventDefault();
            if (!target.disabled) target.classList.add('drag-over-highlight');
        });

        target.addEventListener('dragleave', () => {
            target.classList.remove('drag-over-highlight');
        });

        target.addEventListener('drop', event => {
            event.preventDefault();
            target.classList.remove('drag-over-highlight');
            const answerId = event.dataTransfer.getData('text/plain') || draggedAnswerId;
            tryAnswer(answerId, questionId);
        });

        box.append(first, text, target);
        return box;
    }

    function renderRound() {
        currentQuestions = chooseRound();
        currentMissed = new Set();
        solvedQuestions = new Set();
        selectedAnswerId = null;
        draggedAnswerId = null;

        answersContainer.innerHTML = '';
        equationsContainer.innerHTML = '';
        summary.hidden = true;
        roundMessage.textContent = roundNumber === 1
            ? 'Ten mixed facts. Mistakes will come back next round.'
            : reviewPool.size > 0
                ? `${reviewPool.size} review fact${reviewPool.size === 1 ? '' : 's'} mixed into this round.`
                : 'Great work — this round starts fresh with new mixed facts.';

        const answers = shuffle(currentQuestions.map((question, index) => ({ question, index })));
        answers.forEach(({ question, index }) => {
            answersContainer.appendChild(makeAnswerCard(question, index));
        });

        currentQuestions.forEach((question, index) => {
            equationsContainer.appendChild(makeEquation(question, index));
        });

        updateStatus();
    }

    function finishRound() {
        for (const fact of currentQuestions) {
            if (currentMissed.has(fact.key)) {
                reviewPool.set(fact.key, fact);
            } else {
                reviewPool.delete(fact.key);
            }
        }

        const score = ROUND_SIZE - currentMissed.size;
        summaryScore.textContent = `${score} / ${ROUND_SIZE} first-try correct`;
        missedList.innerHTML = '';

        if (currentMissed.size === 0) {
            const item = document.createElement('li');
            item.className = 'all-correct';
            item.textContent = 'Perfect round — no review facts to carry forward.';
            missedList.appendChild(item);
        } else {
            const missedFacts = currentQuestions.filter(fact => currentMissed.has(fact.key));
            missedFacts.forEach(fact => {
                const item = document.createElement('li');
                item.textContent = `${fact.a} × ${fact.b} = ${fact.result}`;
                missedList.appendChild(item);
            });
        }

        const carryCount = reviewPool.size;
        const note = document.getElementById('review-note');
        note.textContent = carryCount > 0
            ? `${carryCount} missed fact${carryCount === 1 ? '' : 's'} will return in the next round.`
            : 'Your next round will be a fresh mix of 10 facts.';

        summary.hidden = false;
        summary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    nextRoundBtn.addEventListener('click', () => {
        roundNumber += 1;
        renderRound();
        document.querySelector('.mixed-game')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    freshStartBtn.addEventListener('click', () => {
        roundNumber = 1;
        reviewPool = new Map();
        renderRound();
    });

    renderRound();
});

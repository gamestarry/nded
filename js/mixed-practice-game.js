document.addEventListener('DOMContentLoaded', () => {
    const ROUND_SIZE = 10;

    const answersContainer = document.getElementById('answers-container');
    const equationsContainer = document.getElementById('equations-container');
    const roundStatus = document.getElementById('round-status');
    const roundMessage = document.getElementById('round-message');
    const checkBtn = document.getElementById('check-answers-btn');
    const summary = document.getElementById('round-summary');
    const summaryScore = document.getElementById('summary-score');
    const missedList = document.getElementById('missed-list');
    const reviewHeading = document.getElementById('review-heading');
    const reviewNote = document.getElementById('review-note');
    const nextRoundBtn = document.getElementById('next-round-btn');
    const freshStartBtn = document.getElementById('fresh-start-btn');

    if (
        !answersContainer ||
        !equationsContainer ||
        !roundStatus ||
        !roundMessage ||
        !checkBtn ||
        !summary ||
        !summaryScore ||
        !missedList ||
        !reviewHeading ||
        !reviewNote ||
        !nextRoundBtn ||
        !freshStartBtn
    ) {
        return;
    }

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
    let selectedAnswerId = null;
    let draggedAnswerId = null;
    let roundChecked = false;

    // questionId -> answerId
    let placements = new Map();
    // answerId -> questionId
    let answerLocations = new Map();

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

    function getAnswerCard(answerId) {
        return document.querySelector(`[data-answer-id="${answerId}"]`);
    }

    function getTarget(questionId) {
        return document.querySelector(`[data-question-id="${questionId}"] .equation-result`);
    }

    function clearSelection() {
        selectedAnswerId = null;
        document.querySelectorAll('.mixed-answer.selected').forEach(card => {
            card.classList.remove('selected');
            card.setAttribute('aria-pressed', 'false');
        });
    }

    function updateStatus() {
        roundStatus.textContent = `Round ${roundNumber} · ${placements.size}/${ROUND_SIZE} placed`;
    }

    function returnCardToBank(answerId) {
        if (roundChecked) return;

        const card = getAnswerCard(answerId);
        if (!card) return;

        const oldQuestionId = answerLocations.get(answerId);
        if (oldQuestionId) {
            placements.delete(oldQuestionId);
            answerLocations.delete(answerId);
            const oldTarget = getTarget(oldQuestionId);
            if (oldTarget) {
                oldTarget.classList.remove('filled');
                oldTarget.setAttribute('aria-label', 'Empty answer slot');
            }
        }

        answersContainer.appendChild(card);
        card.classList.remove('placed');
        card.dataset.location = 'bank';
        updateStatus();
    }

    function placeCard(answerId, questionId) {
        if (roundChecked || !answerId || !questionId) return;

        const card = getAnswerCard(answerId);
        const target = getTarget(questionId);
        if (!card || !target) return;

        const occupiedAnswerId = placements.get(questionId);
        if (occupiedAnswerId && occupiedAnswerId !== answerId) {
            returnCardToBank(occupiedAnswerId);
        }

        const oldQuestionId = answerLocations.get(answerId);
        if (oldQuestionId && oldQuestionId !== questionId) {
            placements.delete(oldQuestionId);
            const oldTarget = getTarget(oldQuestionId);
            if (oldTarget) {
                oldTarget.classList.remove('filled');
                oldTarget.setAttribute('aria-label', 'Empty answer slot');
            }
        }

        target.appendChild(card);
        target.classList.add('filled');
        target.setAttribute('aria-label', `Placed answer ${card.dataset.value}`);
        card.classList.add('placed');
        card.dataset.location = questionId;

        placements.set(questionId, answerId);
        answerLocations.set(answerId, questionId);

        clearSelection();
        roundMessage.textContent = 'Answer placed. You can move it again before checking.';
        updateStatus();
    }

    function selectCard(answerId) {
        if (roundChecked) return;

        const card = getAnswerCard(answerId);
        if (!card) return;

        // Tapping a card that is already in a slot returns it to the answer bank.
        if (answerLocations.has(answerId)) {
            returnCardToBank(answerId);
            clearSelection();
            roundMessage.textContent = 'Answer returned to the top.';
            return;
        }

        const alreadySelected = selectedAnswerId === answerId;
        clearSelection();

        if (!alreadySelected) {
            selectedAnswerId = answerId;
            card.classList.add('selected');
            card.setAttribute('aria-pressed', 'true');
            roundMessage.textContent = `Selected ${card.dataset.value}. Now choose any answer slot.`;
        }
    }

    function makeAnswerCard(question, index) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'answer mixed-answer';
        button.textContent = question.result;
        button.dataset.value = String(question.result);
        button.dataset.answerId = `a-${roundNumber}-${index}`;
        button.dataset.location = 'bank';
        button.setAttribute('aria-label', `Answer ${question.result}`);
        button.setAttribute('aria-pressed', 'false');
        button.draggable = true;

        button.addEventListener('click', event => {
            event.stopPropagation();
            selectCard(button.dataset.answerId);
        });

        button.addEventListener('dragstart', event => {
            if (roundChecked) {
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

        const target = document.createElement('div');
        target.className = 'equation-result';
        target.setAttribute('role', 'button');
        target.setAttribute('tabindex', '0');
        target.setAttribute('aria-label', 'Empty answer slot');

        function activateTarget() {
            if (roundChecked) return;

            if (selectedAnswerId) {
                placeCard(selectedAnswerId, questionId);
                return;
            }

            const placedAnswerId = placements.get(questionId);
            if (placedAnswerId) {
                returnCardToBank(placedAnswerId);
                roundMessage.textContent = 'Answer returned to the top.';
            } else {
                roundMessage.textContent = 'Choose an answer card first.';
            }
        }

        target.addEventListener('click', activateTarget);
        target.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activateTarget();
            }
        });

        target.addEventListener('dragover', event => {
            if (roundChecked) return;
            event.preventDefault();
            target.classList.add('drag-over-highlight');
        });

        target.addEventListener('dragleave', () => {
            target.classList.remove('drag-over-highlight');
        });

        target.addEventListener('drop', event => {
            if (roundChecked) return;

            event.preventDefault();
            target.classList.remove('drag-over-highlight');
            const answerId = event.dataTransfer.getData('text/plain') || draggedAnswerId;
            placeCard(answerId, questionId);
        });

        box.append(first, text, target);
        return box;
    }

    function renderRound() {
        currentQuestions = chooseRound();
        placements = new Map();
        answerLocations = new Map();
        selectedAnswerId = null;
        draggedAnswerId = null;
        roundChecked = false;

        answersContainer.innerHTML = '';
        equationsContainer.innerHTML = '';
        summary.hidden = true;
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Answers';

        roundMessage.textContent = roundNumber === 1
            ? 'Place as many answers as you can, then check when you are ready.'
            : reviewPool.size > 0
                ? `${reviewPool.size} review fact${reviewPool.size === 1 ? '' : 's'} are mixed into this round.`
                : 'Fresh mixed round — check whenever you are ready.';

        const answers = shuffle(currentQuestions.map((question, index) => ({ question, index })));
        answers.forEach(({ question, index }) => {
            answersContainer.appendChild(makeAnswerCard(question, index));
        });

        currentQuestions.forEach((question, index) => {
            equationsContainer.appendChild(makeEquation(question, index));
        });

        updateStatus();
    }

    function gradeRound() {
        if (roundChecked) return;

        roundChecked = true;
        clearSelection();
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checked';

        let correctCount = 0;
        const missedFacts = [];

        currentQuestions.forEach((fact, index) => {
            const questionId = `q-${roundNumber}-${index}`;
            const equationEl = document.querySelector(`[data-question-id="${questionId}"]`);
            const target = getTarget(questionId);
            const answerId = placements.get(questionId);
            const answerCard = answerId ? getAnswerCard(answerId) : null;
            const submittedValue = answerCard ? Number(answerCard.dataset.value) : null;
            const isCorrect = submittedValue === fact.result;

            if (target) {
                target.classList.remove('result-correct', 'result-wrong', 'result-unanswered');
            }

            if (isCorrect) {
                correctCount += 1;
                reviewPool.delete(fact.key);
                equationEl?.classList.add('checked-correct');
                target?.classList.add('result-correct');
            } else {
                reviewPool.set(fact.key, fact);
                equationEl?.classList.add('checked-wrong');

                if (submittedValue === null) {
                    target?.classList.add('result-unanswered');
                } else {
                    target?.classList.add('result-wrong');
                }

                missedFacts.push({
                    fact,
                    submittedValue
                });
            }
        });

        document.querySelectorAll('.mixed-answer').forEach(card => {
            card.draggable = false;
            card.classList.remove('selected', 'dragging');
        });

        summaryScore.textContent = `${correctCount} / ${ROUND_SIZE} correct`;
        missedList.innerHTML = '';

        const headingIcon = reviewHeading.querySelector('.review-heading-icon');
        const headingText = reviewHeading.querySelector('strong');

        if (missedFacts.length === 0) {
            reviewHeading.classList.add('all-clear');
            if (headingIcon) headingIcon.textContent = '✓';
            if (headingText) headingText.textContent = 'No Facts Need Review';

            const item = document.createElement('li');
            item.className = 'all-correct';
            item.textContent = 'Perfect round — no facts need to carry forward.';
            missedList.appendChild(item);
        } else {
            reviewHeading.classList.remove('all-clear');
            if (headingIcon) headingIcon.textContent = '⚠';
            if (headingText) {
                headingText.textContent = `${missedFacts.length} Fact${missedFacts.length === 1 ? '' : 's'} Need Another Look`;
            }

            missedFacts.forEach(({ fact, submittedValue }) => {
                const item = document.createElement('li');

                const factLine = document.createElement('strong');
                factLine.textContent = `${fact.a} × ${fact.b}`;

                const submittedLine = document.createElement('span');
                submittedLine.className = 'answer-review submitted-answer';
                submittedLine.textContent = submittedValue === null
                    ? 'No answer ✕'
                    : `Your answer: ${submittedValue} ✕`;

                const correctLine = document.createElement('span');
                correctLine.className = 'answer-review correct-answer';
                correctLine.textContent = `Correct answer: ${fact.result} ✓`;

                item.append(factLine, submittedLine, correctLine);
                missedList.appendChild(item);
            });
        }

        const carryCount = reviewPool.size;
        reviewNote.textContent = carryCount > 0
            ? `${carryCount} fact${carryCount === 1 ? '' : 's'} will return in the next round.`
            : 'Your next round will be a fresh mix of 10 facts.';

        roundMessage.textContent = 'Round checked. Review the results below.';
        summary.hidden = false;
        summary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    answersContainer.addEventListener('dragover', event => {
        if (roundChecked) return;
        event.preventDefault();
        answersContainer.classList.add('return-zone-active');
    });

    answersContainer.addEventListener('dragleave', event => {
        if (!answersContainer.contains(event.relatedTarget)) {
            answersContainer.classList.remove('return-zone-active');
        }
    });

    answersContainer.addEventListener('drop', event => {
        if (roundChecked) return;

        event.preventDefault();
        answersContainer.classList.remove('return-zone-active');
        const answerId = event.dataTransfer.getData('text/plain') || draggedAnswerId;
        if (answerId) {
            returnCardToBank(answerId);
            clearSelection();
            roundMessage.textContent = 'Answer returned to the top.';
        }
    });

    checkBtn.addEventListener('click', gradeRound);

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

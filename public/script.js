let questions = [];
let currentQuestionIndex = 0;
let userProfile = { name: '', email: '' };
let answers = {}; // { questionId: answerLabel }
let timerInterval;
const TIME_LIMIT = 120; // 2 minutes per question
let timeLeft = TIME_LIMIT;

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const assessmentScreen = document.getElementById('assessment-screen');
const completionScreen = document.getElementById('completion-screen');
const questionContainer = document.getElementById('question-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const qCurrentEl = document.getElementById('q-current');
const qTotalEl = document.getElementById('q-total');
const timerEl = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');

// Theme Toggle Logic
const themeToggleBtn = document.getElementById('theme-toggle');

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// Init Theme
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
});

// Modal Elements
const modalOverlay = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');

// Custom Modal Function
function showModal(title, message, isConfirm = false) {
    return new Promise((resolve) => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        if (isConfirm) {
            modalCancelBtn.style.display = 'inline-block';
            modalConfirmBtn.textContent = 'Confirm';
        } else {
            modalCancelBtn.style.display = 'none';
            modalConfirmBtn.textContent = 'Close';
        }

        modalOverlay.classList.remove('hidden');
        // Force reflow
        void modalOverlay.offsetWidth;
        modalOverlay.classList.add('active');

        const close = (result) => {
            modalOverlay.classList.remove('active');
            setTimeout(() => modalOverlay.classList.add('hidden'), 400);
            resolve(result);
        };

        modalConfirmBtn.onclick = () => close(true);
        modalCancelBtn.onclick = () => close(false);
    });
}

// Prevent Refresh Warning
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
});

// Incapable Button Handler
document.getElementById('incapable-btn').addEventListener('click', async () => {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;

    if (!name || !email) {
        await showModal("Required", "Please enter your name and email first so we can record this.");
        return;
    }

    const confirmed = await showModal("Confirm Action", "Are you sure? This will end the assessment.", true);
    if(confirmed) {
        try {
            await fetch('/api/incapable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email })
            });
            await showModal("Recorded", "Recorded. Honesty is a virtue.");
            location.reload();
        } catch (err) {
            console.error(err);
        }
    }
});

// Init
document.getElementById('start-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    userProfile.name = document.getElementById('name').value;
    userProfile.email = document.getElementById('email').value;

    try {
        const res = await fetch('/api/questions');
        questions = await res.json();
        qTotalEl.textContent = String(questions.length).padStart(2, '0');
        
        startAssessment();
    } catch (err) {
        console.error('Failed to load questions', err);
        await showModal("Error", "Error loading assessment. Please try again.");
    }
});

function startAssessment() {
    welcomeScreen.classList.remove('active');
    setTimeout(() => {
        welcomeScreen.classList.add('hidden');
        assessmentScreen.classList.remove('hidden');
        setTimeout(() => assessmentScreen.classList.add('active'), 50);
        loadQuestion(0);
    }, 600);
}

function loadQuestion(index) {
    clearInterval(timerInterval);
    currentQuestionIndex = index;
    timeLeft = TIME_LIMIT;
    updateTimerDisplay();
    
    // Update UI
    qCurrentEl.textContent = String(index + 1).padStart(2, '0');
    
    // Lock Previous (Always)
    prevBtn.disabled = true;
    prevBtn.classList.add('locked');

    // Lock Next (Until Answered)
    // Check if we already have an answer (unlikely in strict flow, but good for robustness)
    const question = questions[index];
    const currentAnswer = answers[question.id];

    if (currentAnswer) {
        nextBtn.disabled = false;
        nextBtn.classList.remove('locked');
    } else {
        nextBtn.disabled = true;
        nextBtn.classList.add('locked');
    }
    
    nextBtn.querySelector('.btn-text').textContent = index === questions.length - 1 ? 'Finish Assessment' : 'Next Scenario';
    
    // Render Question
    questionContainer.innerHTML = `
        <h2 class="question-text fade-in">${question.scenario}</h2>
        <div class="options-grid fade-in delay-1">
            ${question.options.map(opt => `
                <div class="option-card ${currentAnswer === opt.label ? 'selected' : ''}" onclick="selectOption('${opt.label}')">
                    <span class="option-label">${opt.label}</span>
                    <span class="option-text">${opt.text}</span>
                </div>
            `).join('')}
        </div>
    `;

    // Start Timer
    startTimer();
    updateProgressBar();
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // If time runs out, maybe auto-select? Or just force next?
            // For now, let's just force next if they have an answer, or alert.
            // But per request "Unlock next only if answer", we'll just stop timer.
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Visual urgency
    if (timeLeft < 30) timerEl.style.color = '#ff4d4d';
    else timerEl.style.color = 'var(--text-primary)';
}

function selectOption(label) {
    const cards = document.querySelectorAll('.option-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    // Find clicked card
    const selectedText = questions[currentQuestionIndex].options.find(o => o.label === label).text;
    const cardsArray = Array.from(cards);
    const targetCard = cardsArray.find(c => c.querySelector('.option-label').textContent === label);
    if(targetCard) targetCard.classList.add('selected');

    // Store Answer
    const qId = questions[currentQuestionIndex].id;
    answers[qId] = label;

    // Unlock Next Button
    nextBtn.disabled = false;
    nextBtn.classList.remove('locked');

    // Send Incremental Update
    sendUpdate(qId, label, 'in_progress');
}

async function sendUpdate(questionId, answer, status) {
    await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: userProfile.email,
            name: userProfile.name,
            questionId,
            answer,
            status
        })
    });
}

function updateProgressBar() {
    const progress = ((currentQuestionIndex) / questions.length) * 100;
    progressBar.style.width = `${progress}%`;
}

// Navigation
nextBtn.addEventListener('click', handleNext);
// Prev button is disabled, no listener needed.

async function handleNext() {
    if (currentQuestionIndex < questions.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        await finishAssessment();
    }
}

async function finishAssessment() {
    clearInterval(timerInterval);
    
    // Calculate simple score/profile (Mock logic based on README)
    // In a real app, this would be more complex
    const profile = calculateProfile(answers);

    await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: userProfile.email,
            name: userProfile.name,
            answers,
            profile
        })
    });

    assessmentScreen.classList.remove('active');
    setTimeout(() => {
        assessmentScreen.classList.add('hidden');
        completionScreen.classList.remove('hidden');
        setTimeout(() => completionScreen.classList.add('active'), 50);
    }, 600);
}

function calculateProfile(answers) {
    // Basic logic mapping based on README ideal: 1-B, 2-C, 3-C, 4-B, 5-B, 6-B, 7-B
    // Just returning raw answers for webhook processing usually, but adding a mock label here
    return "Assessment Completed"; 
}

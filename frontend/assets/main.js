// Pricing calculator
const membersSlider = document.getElementById('members');
const criteriaSlider = document.getElementById('criteria');
const membersValue = document.getElementById('membersValue');
const criteriaValue = document.getElementById('criteriaValue');
const extraPeoplePrice = document.getElementById('extraPeoplePrice');
const extraCriteriaPrice = document.getElementById('extraCriteriaPrice');
const totalPrice = document.getElementById('totalPrice');

function calc() {
    const members = parseInt(membersSlider.value);
    const criteria = parseInt(criteriaSlider.value);

    const basePrice = 750;
    const extraPeople = Math.max(0, members - 4) * 75;
    const extraCriteria = Math.max(0, criteria - 2) * 250;
    const total = basePrice + extraPeople + extraCriteria;

    membersValue.textContent = members;
    criteriaValue.textContent = criteria;
    extraPeoplePrice.textContent = extraPeople + ' €';
    extraCriteriaPrice.textContent = extraCriteria + ' €';
    totalPrice.textContent = total + ' €';

    return { members, criteria, total };
}

membersSlider.addEventListener('input', calc);
criteriaSlider.addEventListener('input', calc);

// Stripe checkout with redirect handling
async function checkout() {
    const company = document.getElementById('company').value;
    const email = document.getElementById('email').value;

    if (!company || !email) {
        alert('Bitte alle Felder ausfüllen');
        return;
    }

    const { members, criteria, total } = calc();

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ members, criteria, total, company, email })
        });

        if (response.redirected) {
            // Якщо сервер повернув редірект — переходимо
            window.location.href = response.url;
        } else {
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert('Fehler: Keine URL vom Server');
            }
        }
    } catch (error) {
        alert('Fehler beim Checkout: ' + error.message);
    }
}

// Cookie banner
function acceptCookies() {
    localStorage.setItem('cookiesAccepted', 'true');
    document.getElementById('cookieBanner').classList.add('hidden');
}

// Show cookie banner if not accepted
if (!localStorage.getItem('cookiesAccepted')) {
    document.getElementById('cookieBanner').classList.remove('hidden');
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Show legal sections
window.addEventListener('hashchange', () => {
    const sections = ['impressum', 'privacy', 'agb', 'widerruf'];
    sections.forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    const hash = window.location.hash.substring(1);
    if (sections.includes(hash)) {
        document.getElementById(hash)?.classList.remove('hidden');
    }
});

// Initialize calculator
calc();

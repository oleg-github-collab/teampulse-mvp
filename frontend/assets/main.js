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
    extraPeoplePrice.textContent = `${extraPeople} €`;
    extraCriteriaPrice.textContent = `${extraCriteria} €`;
    totalPrice.textContent = `${total} €`;

    return { members, criteria, total };
}

membersSlider.addEventListener('input', calc);
criteriaSlider.addEventListener('input', calc);

// Stripe checkout with diagnostics
async function checkout() {
    const company = document.getElementById('company').value.trim();
    const email = document.getElementById('email').value.trim();
    const button = document.querySelector('button[onclick="checkout()"]');
    
    if (!company || !email) {
        alert('Bitte alle Felder ausfüllen');
        return;
    }

    const { members, criteria, total } = calc();

    button.disabled = true;
    button.textContent = 'Bitte warten...';

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: "checkout",
                members,
                criteria,
                total,
                company,
                email
            })
        });

        const raw = await response.text();
        console.log("Server raw response:", raw);

        let data;
        try {
            data = JSON.parse(raw);
        } catch (err) {
            alert("Server returned invalid JSON. Check console.");
            console.error("JSON parse error:", err);
            return;
        }

        if (data.url) {
            window.location.href = data.url;
        } else if (data.error) {
            alert(`Fehler vom Server: ${data.error}`);
        } else {
            alert('Unerwartete Antwort vom Server.');
        }

    } catch (error) {
        console.error("Checkout error:", error);
        alert('Fehler beim Checkout: ' + error.message);
    } finally {
        button.disabled = false;
        button.textContent = 'Mit Stripe bezahlen';
    }
}

// Cookie banner
function acceptCookies() {
    localStorage.setItem('cookiesAccepted', 'true');
    document.getElementById('cookieBanner').classList.add('hidden');
}

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
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const hash = window.location.hash.substring(1);
    if (sections.includes(hash)) {
        const el = document.getElementById(hash);
        if (el) el.classList.remove('hidden');
    }
});

// Initialize calculator
calc();

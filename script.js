(function () {
    'use strict';

    // ---------- Settings (edit here) ----------
    const CONFIG = {
        MATURITY_AGE: 65,
        MIN_AGE: 18,
        MIN_RATE: 6,
        MAX_RATE: 8,
        INCOME_RATIO: 0.35,          // monthly amortization = 35% of gross income
    };

    const FIELDS = ['age', 'tcp', 'dpPercent', 'advancePayment', 'interest', 'years'];
    const $ = (id) => document.getElementById(id);

    // ---------- Helpers ----------
    const peso = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const readNumber = (id) => {
        const raw = $(id).value.replace(/,/g, '').trim();
        return raw === '' ? NaN : parseFloat(raw);
    };

    function fixedPeriodYears(rate) {
        if (isNaN(rate) || rate < CONFIG.MIN_RATE || rate > CONFIG.MAX_RATE) return null;
        if (rate < 6.5) return 1;
        if (rate < 7) return 3;
        return 5;
    }

    const yearsLabel = (y) => y + (y === 1 ? ' year' : ' years');

    // ---------- Inline errors ----------
    function setError(id, message) {
        $(id + '-error').textContent = message;
        $(id).setAttribute('aria-invalid', 'true');
    }

    function clearError(id) {
        $(id + '-error').textContent = '';
        $(id).removeAttribute('aria-invalid');
    }

    const clearAllErrors = () => FIELDS.forEach(clearError);

    // ---------- Number formatting (keeps the cursor in place) ----------
    function formatNumberInput(input) {
        const raw = input.value;
        const caret = input.selectionStart;
        const sigBefore = raw.slice(0, caret).replace(/[^0-9.]/g, '').length;

        const cleaned = raw.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.');
        const whole = parts[0];
        const decimal = parts.slice(1).join('').slice(0, 2);

        let out = whole ? Number(whole).toLocaleString('en-US') : '';
        if (cleaned.includes('.')) out += '.' + decimal;
        input.value = out;

        let pos = 0, count = 0;
        while (pos < out.length && count < sigBefore) {
            if (/[0-9.]/.test(out[pos])) count++;
            pos++;
        }
        input.setSelectionRange(pos, pos);
    }

    // ---------- Live hints ----------
    function updateDpHint() {
        const tcp = readNumber('tcp');
        const dp = parseFloat($('dpPercent').value);
        $('dpPercent-hint').textContent =
            !isNaN(tcp) && !isNaN(dp) && dp >= 0 && dp <= 100
                ? dp + '% = ₱ ' + peso(tcp * dp / 100)
                : '';
    }

    function updateRateHint() {
        const rate = parseFloat($('interest').value);
        const hint = $('interest-hint');
        const years = fixedPeriodYears(rate);

        document.querySelectorAll('.rate-card').forEach((card) => {
            card.classList.toggle('active', years !== null && Number(card.dataset.years) === years);
        });

        hint.classList.remove('warn');
        if ($('interest').value === '') {
            hint.textContent = 'Accepted rates: ' + CONFIG.MIN_RATE.toFixed(2) + '% to ' + CONFIG.MAX_RATE.toFixed(2) + '%.';
        } else if (years === null) {
            hint.textContent = 'Rate must be between ' + CONFIG.MIN_RATE + '% and ' + CONFIG.MAX_RATE + '%.';
            hint.classList.add('warn');
        } else {
            hint.textContent = 'Rate is fixed for the first ' + yearsLabel(years) + '.';
        }
    }

    function updateTermHint() {
        const age = parseFloat($('age').value);
        const hint = $('years-hint');
        const years = parseFloat($('years').value);
        hint.classList.remove('warn');

        if (isNaN(age) || age < CONFIG.MIN_AGE || age >= CONFIG.MATURITY_AGE) {
            hint.textContent = 'Enter your age to see the maximum term.';
            return;
        }
        const maxTerm = CONFIG.MATURITY_AGE - age;
        hint.textContent = 'Maximum term for your age: ' + maxTerm + ' years.';
        if (!isNaN(years) && years > maxTerm) hint.classList.add('warn');
    }

    // ---------- Validation ----------
    function validate(v) {
        let firstInvalid = null;
        const fail = (id, msg) => { setError(id, msg); firstInvalid = firstInvalid || id; };

        if (isNaN(v.age)) fail('age', 'Enter your age.');
        else if (v.age < CONFIG.MIN_AGE) fail('age', 'Age must be at least ' + CONFIG.MIN_AGE + '.');
        else if (v.age >= CONFIG.MATURITY_AGE) fail('age', 'Age must be below ' + CONFIG.MATURITY_AGE + '.');

        if (isNaN(v.tcp)) fail('tcp', 'Enter the Total Contract Price.');
        else if (v.tcp <= 0) fail('tcp', 'TCP must be greater than 0.');

        if (isNaN(v.dpPercent)) fail('dpPercent', 'Enter the down payment percentage.');
        else if (v.dpPercent < 0 || v.dpPercent > 100) fail('dpPercent', 'Down payment must be between 0% and 100%.');

        if (isNaN(v.advancePayment)) fail('advancePayment', 'Enter the advance payment (use 0 if none).');
        else if (v.advancePayment < 0) fail('advancePayment', 'Advance payment cannot be negative.');
        else if (!isNaN(v.tcp) && !isNaN(v.dpPercent) && v.advancePayment > v.tcp - v.tcp * v.dpPercent / 100) {
            fail('advancePayment', 'Advance payment cannot exceed the remaining balance after the down payment.');
        }

        if (isNaN(v.interest)) fail('interest', 'Enter the interest rate.');
        else if (v.interest < CONFIG.MIN_RATE || v.interest > CONFIG.MAX_RATE) {
            fail('interest', 'Rate must be between ' + CONFIG.MIN_RATE + '% and ' + CONFIG.MAX_RATE + '%.');
        }

        if (isNaN(v.years)) fail('years', 'Enter the loan term.');
        else if (v.years <= 0) fail('years', 'Loan term must be greater than 0.');

        return firstInvalid;
    }

    // ---------- Calculation ----------
    function monthlyPayment(loan, annualRate, years) {
        if (loan === 0) return 0;
        const n = years * 12;
        const r = annualRate / 100 / 12;
        if (r === 0) return loan / n;
        const f = Math.pow(1 + r, n);
        return (loan * r * f) / (f - 1);
    }

    function calculate(event) {
        event.preventDefault();
        clearAllErrors();

        const v = {
            age: parseFloat($('age').value),
            tcp: readNumber('tcp'),
            dpPercent: parseFloat($('dpPercent').value),
            advancePayment: readNumber('advancePayment'),
            interest: parseFloat($('interest').value),
            years: parseFloat($('years').value)
        };

        const firstInvalid = validate(v);
        if (firstInvalid) {
            $('result').hidden = true;
            $(firstInvalid).focus();
            return;
        }

        const dp = v.tcp * v.dpPercent / 100;
        const totalPaid = dp + v.advancePayment;
        const loan = v.tcp - dp - v.advancePayment;
        const monthly = monthlyPayment(loan, v.interest, v.years);
        const income = monthly / CONFIG.INCOME_RATIO;

        const maturityAge = Math.round((v.age + v.years) * 10) / 10;
        const withinAge = maturityAge <= CONFIG.MATURITY_AGE;
        const fixedYears = fixedPeriodYears(v.interest);

        $('resultTCP').textContent = peso(v.tcp);
        $('totalPayments').textContent = peso(totalPaid);
        $('loanableAmount').textContent = peso(loan);
        $('resultRate').textContent = v.interest.toFixed(2);
        $('resultFixed').textContent = '(fixed for the first ' + yearsLabel(fixedYears) + ')';
        $('monthly').textContent = peso(monthly);
        $('income').textContent = peso(income);
        $('maturityAge').textContent = maturityAge;

        const q = $('qualification');
        q.className = 'qualification ' + (withinAge ? 'qualified' : 'not-qualified');
        q.innerHTML = '';
        const title = document.createElement('span');
        title.textContent = withinAge ? '✓ WITHIN AGE LIMIT' : '✕ EXCEEDS AGE LIMIT';
        const detail = document.createElement('small');
        detail.textContent = withinAge
            ? 'Loan maturity is at age ' + maturityAge + ', within the maximum age of ' + CONFIG.MATURITY_AGE + '.'
            : 'Loan maturity is at age ' + maturityAge + ', which exceeds the maximum age of ' +
              CONFIG.MATURITY_AGE + '. Try a term of ' + (CONFIG.MATURITY_AGE - v.age) + ' years or less.';
        q.append(title, detail);

        $('printDate').textContent = 'Computed on ' + new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

        const result = $('result');
        result.hidden = false;
        result.scrollIntoView({ behavior: 'smooth', block: 'start' });
        result.focus({ preventScroll: true });
    }

    function reset() {
        $('calcForm').reset();
        clearAllErrors();
        $('result').hidden = true;
        updateDpHint();
        updateRateHint();
        updateTermHint();
        $('age').focus();
    }

    // ---------- Wire up ----------
    $('calcForm').addEventListener('submit', calculate);
    $('resetBtn').addEventListener('click', reset);
    $('printBtn').addEventListener('click', () => window.print());

    ['tcp', 'advancePayment'].forEach((id) =>
        $(id).addEventListener('input', (e) => { formatNumberInput(e.target); updateDpHint(); })
    );
    $('dpPercent').addEventListener('input', updateDpHint);
    $('interest').addEventListener('input', updateRateHint);
    $('age').addEventListener('input', updateTermHint);
    $('years').addEventListener('input', updateTermHint);

    // Clear a field's error as soon as the user edits it
    FIELDS.forEach((id) => $(id).addEventListener('input', () => clearError(id)));
})();

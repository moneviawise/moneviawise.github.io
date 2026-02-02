document.addEventListener("DOMContentLoaded", () => {
    // ---------- Helpers ----------
    const $ = (sel) => document.querySelector(sel);

    function money(n) {
        return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
    }

    function monthsToYearsMonths(m) {
        const years = Math.floor(m / 12);
        const months = m % 12;
        if (years === 0) return `${months} month${months === 1 ? "" : "s"}`;
        if (months === 0) return `${years} year${years === 1 ? "" : "s"}`;
        return `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"}`;
    }

    function addMonths(date, months) {
        const d = new Date(date);
        const day = d.getDate();
        d.setMonth(d.getMonth() + months);
        if (d.getDate() < day) d.setDate(0);
        return d;
    }

    function formatDate(date) {
        return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    function showError(msg) {
        const box = $("#errorBox");
        box.textContent = msg || "";
        box.style.display = msg ? "block" : "none";
    }

    function parseNum(v) {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : NaN;
    }

    // ---------- UI: debts table ----------
    function addDebtRow({ name = "", balance = "", apr = "", min = "" } = {}) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td style="padding:.5rem;">
            <input class="mw-debt-name" type="text" value="${escapeHtml(name)}"
                style="width:100%; padding:.5rem .6rem; border-radius:.75rem; border:1px solid var(--mw-border);" placeholder="e.g., Visa" />
        </td>
        <td style="padding:.5rem; text-align:right;">
            <input class="mw-debt-balance" type="number" step="0.01" min="0" value="${balance}"
                style="width:140px; max-width:100%; padding:.5rem .6rem; border-radius:.75rem; border:1px solid var(--mw-border); text-align:right;" placeholder="5200" />
        </td>
        <td style="padding:.5rem; text-align:right;">
            <input class="mw-debt-apr" type="number" step="0.01" min="0" value="${apr}"
                style="width:120px; max-width:100%; padding:.5rem .6rem; border-radius:.75rem; border:1px solid var(--mw-border); text-align:right;" placeholder="19.99" />
        </td>
        <td style="padding:.5rem; text-align:right;">
            <input class="mw-debt-min" type="number" step="0.01" min="0" value="${min}"
                style="width:120px; max-width:100%; padding:.5rem .6rem; border-radius:.75rem; border:1px solid var(--mw-border); text-align:right;" placeholder="75" />
        </td>
        <td style="padding:.5rem; text-align:right;">
            <button type="button" class="btn btn-ghost mw-remove" style="padding:.45rem .8rem;">X</button>
        </td>
        `;
        tr.querySelector(".mw-remove").addEventListener("click", () => tr.remove());
        $("#debtsBody").appendChild(tr);
    }

    function escapeHtml(str) {
        return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function getDebtsFromUI() {
        const rows = Array.from(document.querySelectorAll("#debtsBody tr"));
        const debts = rows.map((tr, idx) => {
        const name = tr.querySelector(".mw-debt-name").value.trim() || `Debt ${idx + 1}`;
        const balance = parseNum(tr.querySelector(".mw-debt-balance").value);
        const apr = parseNum(tr.querySelector(".mw-debt-apr").value);
        const min = parseNum(tr.querySelector(".mw-debt-min").value);
        return { name, balance, apr, min };
        });
        return debts;
    }

    // ---------- Core: Snowball/Avalanche payoff simulation ----------
    function simulatePayoff(debtsInput, method, extraBudget) {
        // Clone + validate
        const debts = debtsInput.map(d => ({
        name: d.name,
        balance: d.balance,
        apr: d.apr,
        min: d.min,
        paidOffMonth: null,
        interestPaid: 0,
        totalPaid: 0
        }));

        if (debts.length === 0) throw new Error("Add at least one debt.");

        debts.forEach(d => {
        if (!Number.isFinite(d.balance) || d.balance < 0) throw new Error("Each debt needs a valid balance.");
        if (!Number.isFinite(d.apr) || d.apr < 0) throw new Error("Each debt needs a valid APR.");
        if (!Number.isFinite(d.min) || d.min < 0) throw new Error("Each debt needs a valid minimum payment.");
        });

        if (!Number.isFinite(extraBudget) || extraBudget < 0) throw new Error("Extra monthly budget must be 0 or more.");

        // Remove already-zero debts
        const active = debts.filter(d => d.balance > 0.01);
        if (active.length === 0) {
        return {
            months: 0, totalInterest: 0, totalPaid: 0,
            payoffOrder: [], details: debts
        };
        }

        // Total minimum must be enough to avoid “interest-only forever” on *targeted debt*
        // We’ll handle detection by a safety cap + a quick check on first month of current target.

        const MAX_MONTHS = 1200; // safety cap (100 years)
        let month = 0;
        let totalInterest = 0;
        let totalPaid = 0;

        function pickTarget() {
        const remaining = debts.filter(d => d.balance > 0.01);
        if (remaining.length === 0) return null;

        // Snowball: smallest balance first
        // Avalanche: highest APR first (tie-breaker: higher balance)
        remaining.sort((a, b) => {
            if (method === "snowball") return a.balance - b.balance;
            if (b.apr !== a.apr) return b.apr - a.apr;
            return b.balance - a.balance;
        });
        return remaining[0];
        }

        // Track the order in which debts are *targeted* (unique)
        const payoffOrder = [];

        while (month < MAX_MONTHS) {
        const remaining = debts.filter(d => d.balance > 0.01);
        if (remaining.length === 0) break;
        month += 1;

        const target = pickTarget();
        if (target && !payoffOrder.includes(target.name)) payoffOrder.push(target.name);

        // 1) Accrue interest on all remaining debts
        for (const d of remaining) {
            const r = (d.apr / 100) / 12;
            const interest = d.balance * r;
            d.balance += interest;
            d.interestPaid += interest;
            totalInterest += interest;
        }

        // 2) Pay minimums first (or remaining balance if smaller)
        let freedUp = 0; // if a debt gets paid off this month, its unused payment becomes available
        for (const d of remaining) {
            const p = Math.min(d.min, d.balance);
            d.balance -= p;
            d.totalPaid += p;
            totalPaid += p;

            // If paid off, record payoff month; any leftover from min (if min > balance pre-pay) is freed (rare due to Math.min)
            if (d.balance <= 0.01 && d.paidOffMonth === null) {
            d.balance = 0;
            d.paidOffMonth = month;
            }
        }

        // 3) Apply extra budget + rollover mins from already-paid debts (rollover is naturally handled because we
        //    keep paying mins only on remaining debts; the sum of mins for paid debts is effectively “available”.)
        const remainingAfterMins = debts.filter(d => d.balance > 0.01);

        const sumMinsRemaining = remainingAfterMins.reduce((s, d) => s + d.min, 0);
        const sumMinsAll = debts.reduce((s, d) => s + d.min, 0);
        const rollover = Math.max(0, sumMinsAll - sumMinsRemaining);

        let extra = extraBudget + rollover;

        // Apply extra to the current target (and cascade if target pays off mid-month)
        while (extra > 0.01) {
            const t = pickTarget();
            if (!t) break;

            // Quick “won’t payoff” guard (payment <= interest each month) on target:
            const rt = (t.apr / 100) / 12;
            const targetInterestNextMonth = t.balance * rt;
            // If extra + min is still <= interest next month, it can stall (especially with high APR)
            if (rt > 0 && (t.min + extraBudget) <= targetInterestNextMonth && debts.filter(d => d.balance > 0.01).length === 1) {
            throw new Error("This plan may not pay off (payments are too low vs interest). Increase minimums or extra budget.");
            }

            const pay = Math.min(extra, t.balance);
            t.balance -= pay;
            t.totalPaid += pay;
            totalPaid += pay;
            extra -= pay;

            if (t.balance <= 0.01 && t.paidOffMonth === null) {
            t.balance = 0;
            t.paidOffMonth = month;
            }
        }
        }

        if (month >= MAX_MONTHS) {
        throw new Error("Calculation hit the safety limit (plan may not pay off). Increase payments and try again.");
        }

        return {
        months: month,
        totalInterest,
        totalPaid,
        payoffOrder,
        details: debts
        };
    }

    // ---------- Render results ----------
    function renderResults(res) {
        $("#payoffTime").textContent = monthsToYearsMonths(res.months);
        $("#payoffDate").textContent = res.months === 0 ? "—" : formatDate(addMonths(new Date(), res.months));
        $("#totalInterest").textContent = money(res.totalInterest);
        $("#totalPaid").textContent = money(res.totalPaid);

        // Order list
        const ol = $("#orderList");
        ol.innerHTML = "";
        res.payoffOrder.forEach(name => {
        const li = document.createElement("li");
        li.textContent = name;
        ol.appendChild(li);
        });

        // Details table
        const tbody = $("#detailsBody");
        tbody.innerHTML = "";
        res.details.forEach(d => {
        const tr = document.createElement("tr");
        const payoffMonths = d.paidOffMonth ?? "—";
        const payoffDate = d.paidOffMonth ? formatDate(addMonths(new Date(), d.paidOffMonth)) : "—";
        tr.innerHTML = `
            <td style="padding:.6rem; text-align:left;">${escapeHtml(d.name)}</td>
            <td style="padding:.6rem; text-align:right;">${payoffMonths}</td>
            <td style="padding:.6rem; text-align:right;">${money(d.interestPaid)}</td>
            <td style="padding:.6rem; text-align:right;">${payoffDate}</td>
        `;
        tbody.appendChild(tr);
        });
    }

    // ---------- Wire up ----------
    function getMethod() {
        return document.querySelector('input[name="method"]:checked')?.value || "snowball";
    }

    function resetAll() {
        $("#debtsBody").innerHTML = "";
        addDebtRow();
        addDebtRow();
        $("#extraBudget").value = "0";
        document.querySelector('input[name="method"][value="snowball"]').checked = true;

        $("#payoffTime").textContent = "—";
        $("#payoffDate").textContent = "—";
        $("#totalInterest").textContent = "—";
        $("#totalPaid").textContent = "—";
        $("#orderList").innerHTML = "";
        $("#detailsBody").innerHTML = "";
        showError("");
    }

    $("#addDebtBtn").addEventListener("click", () => addDebtRow());

    $("#loadExampleBtn").addEventListener("click", () => {
        $("#debtsBody").innerHTML = "";
        addDebtRow({ name: "Visa", balance: "3200", apr: "22.99", min: "90" });
        addDebtRow({ name: "Car Loan", balance: "8400", apr: "6.49", min: "240" });
        addDebtRow({ name: "Student Loan", balance: "12500", apr: "4.25", min: "140" });
        $("#extraBudget").value = "100";
        showError("");
    });

    $("#calcBtn").addEventListener("click", () => {
        try {
        showError("");
        const debts = getDebtsFromUI();
        const extraBudget = parseNum($("#extraBudget").value || "0");
        const method = getMethod();

        const hasAny = debts.some(d => Number.isFinite(d.balance) && d.balance > 0);
        if (!hasAny) throw new Error("Enter at least one debt with a balance.");

        const res = simulatePayoff(debts, method, extraBudget);
        renderResults(res);
        } catch (e) {
        showError(e.message || "Something went wrong. Check your numbers and try again.");
        }
    });

    $("#resetBtn").addEventListener("click", resetAll);

    // Init with 2 rows
    resetAll();
});

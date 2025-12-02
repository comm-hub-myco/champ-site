// Suggestion Box — posts to a configured form backend (Formspree/Basin/your Worker)
// Configure endpoint in data/site-config.json → suggestionBox.endpoint


const SuggestionBox = (() => {
function formTemplate() {
return `
<form id="sb-form" class="form" novalidate>
<label>
<br></br>
<span class="text" style="font-weight: bold;">(Optional) Community Discussion Topic:</span>
<br></br>
<span class="text" style="font-size: 1rem;">How should members of C.H.A.M.P. communicate? Do you prefer E-mail, Discord, Forums, or something else?</span>
<br></br>
<textarea name="message" rows="3" required placeholder="Type your suggestion here..."></textarea>
</label>
<label>
<span class="text">(Optional) Your Name and Contact Info?</span>
<input name="contact" type="text" placeholder="Your Name and Contact Info..." />
</label>
<button class="primary" type="submit">Submit Feedback</button>
<div class="status" id="sb-status"></div>
</form>
`;
}


function encodeForm(bodyObj) {
return JSON.stringify(bodyObj);
}


function mount(selector, config={}) {
const host = document.querySelector(selector);
host.innerHTML = formTemplate();
const form = host.querySelector('#sb-form');
const status = host.querySelector('#sb-status');


form.addEventListener('submit', async (e) => {
e.preventDefault();
status.textContent = 'Sending...';
const endpoint = config.endpoint;
const payload = {
message: form.message.value.trim(),
contact: form.contact.value.trim() || null,
source: 'champ-site',
at: new Date().toISOString()
};
if (!payload.message) { status.textContent = 'Please write a suggestion.'; return; }
try {
const res = await fetch(endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: encodeForm(payload)
});
if (!res.ok) throw new Error('Bad response');
status.textContent = 'Thanks! Your suggestion was sent.';
form.reset();
} catch (err) {
console.warn(err);
status.textContent = 'Could not send. Please try again later.';
}
});
}


return { mount };
})();

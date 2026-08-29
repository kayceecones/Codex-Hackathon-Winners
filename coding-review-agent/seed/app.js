document.querySelectorAll('.ticket').forEach((ticket) => {
  ticket.addEventListener('click', () => {
    document.querySelectorAll('.ticket').forEach((t) => t.classList.remove('active'));
    ticket.classList.add('active');
  });
});

document.getElementById('send-response').addEventListener('click', () => {
  const textarea = document.getElementById('ai-response');
  console.log('Sending response:', textarea.value);
});

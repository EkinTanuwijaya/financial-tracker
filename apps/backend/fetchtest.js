fetch('http://host.docker.internal:20128/v1/models', {
  headers: { Authorization: 'Bearer sk-dfa8a20352c27954-gcxf7q-8dbbb698' }
})
.then(r => r.text())
.then(console.log)
.catch(console.error);
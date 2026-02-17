\# Dev Commands



\## Test /api/chat (PowerShell)



*[Typical Q/A]

	$body = @{
  		documentText = "This is a medical document."
  		message = "Is this a medical document? (say yes or no)"
	} | ConvertTo-Json -Depth 10

	Invoke-RestMethod -Method POST `
  	-Uri "http://localhost:3000/api/chat" `
  	-ContentType "application/json" `
  	-Body $body

*[Store previous response to variable (for clean printing format)]

	$response = Invoke-RestMethod -Method POST `
  	  -Uri "http://localhost:3000/api/chat" `
  	  -ContentType "application/json" `
          -Body $body

	$response.answer

*[Error handling test - test sends context but no user message - expected response : error status 400]

	Invoke-RestMethod -Method POST `
  	  -Uri http://localhost:3000/api/chat `
          -ContentType "application/json" `
          -Body '{ "documentText":"this is a medical document." }'


*[Testing handling for long documents]
	$longDoc = Get-Content .\sample.txt -Raw

	$body = @{
  	  documentText = $longDoc
  	  message = "Summarize the document."
	} | ConvertTo-Json -Depth 10


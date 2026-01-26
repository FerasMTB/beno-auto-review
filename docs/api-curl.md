# AutoReview API curl example

Set your Next.js base URL (local dev is `http://localhost:3000`), then call the ingest endpoint.
Make sure the server has AWS credentials, `AWS_REGION`, and `REVIEWS_TABLE` configured.
For draft endpoints, set `OPENAI_API_KEY` (and optional `OPENAI_MODEL`).

## POST /reviews/tripadvisor

### Bash/zsh

```bash
API_URL="http://localhost:3000"

curl -X POST "$API_URL/api/reviews/tripadvisor" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
[
  {
    "id": "1043473202",
    "url": "https://www.tripadvisor.com/ShowUserReviews-g295424-d33516469-r1043473202-BENO-Dubai_Emirate_of_Dubai.html",
    "title": "Amazing fast quality service - Continuous support",
    "lang": "en",
    "locationId": "33516469",
    "publishedDate": "2025-12-23",
    "publishedPlatform": "MOBILE",
    "rating": 5,
    "helpfulVotes": 0,
    "text": "Great service and car. We rented a G-Wagon from Hanan at the Beno desk at the W Palm. Car was perfect and Hanan service great, kept supporting us even on her day off. She took care of everything including paperwork and international license conversion in minutes.",
    "roomTip": null,
    "travelDate": "2025-12",
    "tripType": "FAMILY",
    "user": {
      "userId": "A2A264C666EEC8D266E10440425EAF51",
      "name": "karim e",
      "contributions": {
        "totalContributions": 2,
        "helpfulVotes": 0
      },
      "username": "karimelm",
      "userLocation": {
        "shortName": "Casablanca",
        "name": "Casablanca, Morocco",
        "id": "293732"
      },
      "avatar": {
        "id": "452391968",
        "width": 1200,
        "height": 1200,
        "image": "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1a/f6/f4/20/default-avatar-2020-31.jpg"
      },
      "link": "www.tripadvisor.com/Profile/karimelm"
    },
    "ownerResponse": null,
    "subratings": [],
    "photos": [],
    "placeInfo": {
      "id": "33516469",
      "name": "BENO",
      "rating": 4.8,
      "numberOfReviews": 11,
      "locationString": "Dubai, Emirate of Dubai",
      "latitude": null,
      "longitude": null,
      "webUrl": "https://www.tripadvisor.com/Attraction_Review-g295424-d33516469-Reviews-BENO-Dubai_Emirate_of_Dubai.html",
      "website": "http://www.beno.com",
      "address": "Private Kiosk, JBR, Dubai, UAE., Dubai 50000 United Arab Emirates",
      "addressObj": {
        "street1": "Private Kiosk, JBR, Dubai, UAE.",
        "street2": null,
        "city": "Dubai",
        "state": null,
        "country": "United Arab Emirates",
        "postalcode": "50000"
      },
      "ratingHistogram": {
        "count1": 0,
        "count2": 0,
        "count3": 0,
        "count4": 2,
        "count5": 9
      }
    }
  }
]
JSON
```

### PowerShell

```powershell
$env:API_URL = "http://localhost:3000"
$body = @'
[
  {
    "id": "1043473202",
    "url": "https://www.tripadvisor.com/ShowUserReviews-g295424-d33516469-r1043473202-BENO-Dubai_Emirate_of_Dubai.html",
    "title": "Amazing fast quality service - Continuous support",
    "lang": "en",
    "locationId": "33516469",
    "publishedDate": "2025-12-23",
    "publishedPlatform": "MOBILE",
    "rating": 5,
    "helpfulVotes": 0,
    "text": "Great service and car. We rented a G-Wagon from Hanan at the Beno desk at the W Palm. Car was perfect and Hanan service great, kept supporting us even on her day off. She took care of everything including paperwork and international license conversion in minutes.",
    "roomTip": null,
    "travelDate": "2025-12",
    "tripType": "FAMILY",
    "user": {
      "userId": "A2A264C666EEC8D266E10440425EAF51",
      "name": "karim e",
      "contributions": {
        "totalContributions": 2,
        "helpfulVotes": 0
      },
      "username": "karimelm",
      "userLocation": {
        "shortName": "Casablanca",
        "name": "Casablanca, Morocco",
        "id": "293732"
      },
      "avatar": {
        "id": "452391968",
        "width": 1200,
        "height": 1200,
        "image": "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1a/f6/f4/20/default-avatar-2020-31.jpg"
      },
      "link": "www.tripadvisor.com/Profile/karimelm"
    },
    "ownerResponse": null,
    "subratings": [],
    "photos": [],
    "placeInfo": {
      "id": "33516469",
      "name": "BENO",
      "rating": 4.8,
      "numberOfReviews": 11,
      "locationString": "Dubai, Emirate of Dubai",
      "latitude": null,
      "longitude": null,
      "webUrl": "https://www.tripadvisor.com/Attraction_Review-g295424-d33516469-Reviews-BENO-Dubai_Emirate_of_Dubai.html",
      "website": "http://www.beno.com",
      "address": "Private Kiosk, JBR, Dubai, UAE., Dubai 50000 United Arab Emirates",
      "addressObj": {
        "street1": "Private Kiosk, JBR, Dubai, UAE.",
        "street2": null,
        "city": "Dubai",
        "state": null,
        "country": "United Arab Emirates",
        "postalcode": "50000"
      },
      "ratingHistogram": {
        "count1": 0,
        "count2": 0,
        "count3": 0,
        "count4": 2,
        "count5": 9
      }
    }
  }
]
'@

curl.exe -X POST "$env:API_URL/api/reviews/tripadvisor" `
  -H "Content-Type: application/json" `
  --data-binary $body
```

## POST /reviews/google

### Bash/zsh

```bash
API_URL="http://localhost:3000"

curl -X POST "$API_URL/api/reviews/google" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
[
  {
    "reviewId": "Ci9DQUlRQUNvZENodHljRjlvT2xKclNWOUhVVUY1VjBsamEwVTVXWFEzYkV0RlVXYxAB",
    "reviewOrigin": "Google",
    "name": "Aine Zyva",
    "stars": 1,
    "text": "Great location but the room took a while to cool down.",
    "publishedAtDate": "2026-01-25T09:24:39.199Z",
    "reviewUrl": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT2xKclNWOUhVVUY1VjBsamEwVTVXWFEzYkV0RlVXYxAB!2m1!1s0x0:0xe9dcbd1799f01949!3m1!1s2@1:CAIQACodChtycF9oOlJrSV9HUUF5V0lja0U5WXQ3bEtFUWc%7C0dST4MAuu7U%7C?hl=en"
  }
]
JSON
```

### PowerShell

```powershell
$env:API_URL = "http://localhost:3000"
$body = @'
[
  {
    "reviewId": "Ci9DQUlRQUNvZENodHljRjlvT2xKclNWOUhVVUY1VjBsamEwVTVXWFEzYkV0RlVXYxAB",
    "reviewOrigin": "Google",
    "name": "Aine Zyva",
    "stars": 1,
    "text": "Great location but the room took a while to cool down.",
    "publishedAtDate": "2026-01-25T09:24:39.199Z",
    "reviewUrl": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT2xKclNWOUhVVUY1VjBsamEwVTVXWFEzYkV0RlVXYxAB!2m1!1s0x0:0xe9dcbd1799f01949!3m1!1s2@1:CAIQACodChtycF9oOlJrSV9HUUF5V0lja0U5WXQ3bEtFUWc%7C0dST4MAuu7U%7C?hl=en"
  }
]
'@

curl.exe -X POST "$env:API_URL/api/reviews/google" `
  -H "Content-Type: application/json" `
  --data-binary $body
```

## POST /reviews/draft

### Bash/zsh

```bash
API_URL="http://localhost:3000"

curl -X POST "$API_URL/api/reviews/draft" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "review": {
    "reviewId": "Ci9DQUlRQUNvZENodHljRjlvT2xKclNWOUhVVUY1VjBsamEwVTVXWFEzYkV0RlVXYxAB",
    "reviewOrigin": "Google",
    "name": "Aine Zyva",
    "stars": 1,
    "text": "Great location but the room took a while to cool down.",
    "publishedAtDate": "2026-01-25T09:24:39.199Z",
    "reviewUrl": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT2xKclNWOUhVVUY1VjBsamEwVTVXWFEzYkV0RlVXYxAB!2m1!1s0x0:0xe9dcbd1799f01949!3m1!1s2@1:CAIQACodChtycF9oOlJrSV9HUUF5V0lja0U5WXQ3bEtFUWc%7C0dST4MAuu7U%7C?hl=en"
  }
}
JSON
```

### PowerShell

```powershell
$env:API_URL = "http://localhost:3000"
$body = @'
{
  "review": {
    "reviewId": "Ci9DQUlRQUNvZENodHljRjlvT2xKclNWOUhVVUY1VjBsamEwVTVXWFEzYkV0RlVXYxAB",
    "reviewOrigin": "Google",
    "name": "Aine Zyva",
    "stars": 1,
    "text": "Great location but the room took a while to cool down.",
    "publishedAtDate": "2026-01-25T09:24:39.199Z",
    "reviewUrl": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT2xKclNWOUhVVUY1VjBsamEwVTVXWFEzYkV0RlVXYxAB!2m1!1s0x0:0xe9dcbd1799f01949!3m1!1s2@1:CAIQACodChtycF9oOlJrSV9HUUF5V0lja0U5WXQ3bEtFUWc%7C0dST4MAuu7U%7C?hl=en"
  }
}
'@

curl.exe -X POST "$env:API_URL/api/reviews/draft" `
  -H "Content-Type: application/json" `
  --data-binary $body
```

## POST /reviews/draft/all

Draft replies for reviews that do not have a reply yet.

### Bash/zsh

```bash
API_URL="http://localhost:3000"

curl -X POST "$API_URL/api/reviews/draft/all" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "limit": 10,
  "prompt": "Write a warm, concise reply. Mention the guest by name, thank them, and reference one detail from the review. Keep under 60 words."
}
JSON
```

### PowerShell

```powershell
$env:API_URL = "http://localhost:3000"
$body = @'
{
  "limit": 10,
  "prompt": "Write a warm, concise reply. Mention the guest by name, thank them, and reference one detail from the review. Keep under 60 words."
}
'@

curl.exe -X POST "$env:API_URL/api/reviews/draft/all" `
  -H "Content-Type: application/json" `
  --data-binary $body
```

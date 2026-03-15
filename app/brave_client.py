import os
import httpx
import urllib.parse

class BraveSearchClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self.endpoint = "https://api.search.brave.com/res/v1/web/search"

    def search(self, query, count=10):
        if not self.api_key:
            return self._error_html("Brave API Key is missing. Please set BRAVE_API_KEY.")

        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": self.api_key
        }
        params = {
            "q": query,
            "count": min(count, 20)
        }

        try:
            response = httpx.get(self.endpoint, headers=headers, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            return self._format_as_whoogle_html(data)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                return self._error_html("Brave Search API rate limit exceeded.")
            return self._error_html(f"Brave API Error: {e.response.status_code}")
        except httpx.RequestError:
            return self._error_html("Network failure when contacting Brave Search API.")
        except Exception as e:
            return self._error_html(f"An unexpected error occurred: {str(e)}")

    def _error_html(self, message):
        return f'<div id="main"><div class="error-msg" style="padding: 20px; font-size: 1.2rem;">{message}</div></div>'

    def _format_as_whoogle_html(self, data):
        web_results = data.get("web", {}).get("results", [])
        
        if not web_results:
            return self._error_html("No results found.")

        # Wrap in #main so Whoogle's filter picks it up
        html_blocks = ['<div id="main"><div>']
        for result in web_results:
            title = result.get("title", "")
            url = result.get("url", "")
            description = result.get("description", "")
            
            # Format results in the precise HTML structure Whoogle's Display UI expects
            html_blocks.append(f'''
            <div class="ZINbbc xpd O9g5cc uUPGi">
                <div class="kCrYT">
                    <a href="{urllib.parse.quote(url, safe=":/")}">
                        <div class="BNeawe vvjwJb AP7Wnd"><h3 class="zBAuLc lVlxWe">{title}</h3></div>
                        <div class="BNeawe UPmit AP7Wnd">{url}</div>
                    </a>
                </div>
                <div class="kCrYT">
                    <div>
                        <div class="BNeawe s3v9rd AP7Wnd">
                            <div>
                                <div class="BNeawe s3v9rd AP7Wnd">{description}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ''')
        html_blocks.append('</div></div>')
        return "".join(html_blocks)

import os
import httpx
import urllib.parse

class SerpApiClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self.endpoint = "https://serpapi.com/search.json"

    def search(self, query):
        if not self.api_key:
            return self._error_html("SerpAPI Key is missing. Please check your configuration.")

        params = {
            "q": query,
            "api_key": self.api_key,
            "engine": "google"
        }
        
        try:
            response = httpx.get(self.endpoint, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            if "organic_results" in data and len(data["organic_results"]) > 0:
                return self._format_as_whoogle_html(data["organic_results"])
            elif "error" in data:
                return self._error_html(f"SerpAPI Error: {data['error']}")
            else:
                return self._error_html("No results found.")
        except httpx.HTTPStatusError as e:
            return self._error_html(f"SerpAPI HTTP Error: {e.response.status_code}")
        except Exception as e:
            return self._error_html(f"SerpAPI Connection Error: {str(e)}")

    def _error_html(self, message):
        return f'<div id="main"><div class="error-msg" style="padding: 20px; font-size: 1.2rem; color: #d93025;">{message}</div></div>'

    def _format_as_whoogle_html(self, results):
        html_blocks = ['<div id="main"><div>']
        for result in results:
            title = result.get("title", "")
            url = result.get("link", "")
            description = result.get("snippet", "")
            
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

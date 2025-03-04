"use strict";

var rndArticleBuffer = [];
async function WpRndFetchArticles() {
	if(!navigator.onLine) return;

	const url = "https://en.wikipedia.org/w/api.php?" +
		/* new URLSearchParams({
			origin: "*",
			action: "parse", //https://www.mediawiki.org/wiki/API:Parsing_wikitext
			page: "Test",
			format: "json",
		}); */
		/* new URLSearchParams({
			origin: "*",
			action: "query", //https://www.mediawiki.org/wiki/API:Query
			format: "json",
			list: "random", //https://www.mediawiki.org/wiki/API:Random
			formatversion: "2",
			rnnamespace: "0",
			rnlimit: "16",
		}); */
		new URLSearchParams({
			origin: "*",
			action: "query",
			format: "json",
			formatversion: "2",
			generator: "random", //https://www.mediawiki.org/wiki/API:Query#Generators
			grnnamespace: "0",
			grnlimit: "64",
			prop: "pageterms", //https://www.mediawiki.org/wiki/API:Query#API_documentation
		});
	try {
		//https://www.mediawiki.org/wiki/API:Parsing_wikitext#JavaScript
		//https://www.mediawiki.org/wiki/API:Random#JavaScript
		const req = await fetch(url);
		const json = await req.json();
		//rndArticleBuffer.push(...json.query.random);
		rndArticleBuffer.push(...Object.values(json.query.pages));

		if(wpRunning && (outWpRndArticle.classList.contains("stalled") || !outWpRndArticle.hasChildNodes())) //pump it up?
			WpRndNextArticle();
		else
			saveData("rndArticleBuffer", rndArticleBuffer);
	} catch(error) {
		console.error(error);
	}
}
const rndArticleBufferLookahead = 16;
const articleHistoryLimit = 16;
function WpRndNextArticle() {
	if(rndArticleBuffer.length < rndArticleBufferLookahead) WpRndFetchArticles();

	const article = rndArticleBuffer.shift();
	saveData("rndArticleBuffer", rndArticleBuffer);
	if(!article) { //no good for now
		outWpRndArticle.classList.add("stalled");
		return;
	}

	outWpRndArticle.textContent = article.title;
	outWpRndArticle.classList.remove("stalled");

	//update the UI
	const articleAnchor = document.createElement("a"); //link to article
	articleAnchor.textContent = article.terms?.label ?? article.title;
	articleAnchor.href = "https://en.wikipedia.org/wiki/" + (article.title ?? "").replaceAll(" ", "_");

	//replacement
	wpRndInfoCard.innerHTML = "";
	const labelItem = wpRndInfoCard.appendChild(document.createElement("li"));
	labelItem.classList.add("title-item");
	labelItem.append(articleAnchor);

	if(article.terms?.alias) { //list of aliases, not always present
		const aliasList = labelItem.appendChild(document.createElement("ul"));
		aliasList.classList.add("alias-list");
		for(const alias of article.terms.alias) {
			const aliasElem = aliasList.appendChild(document.createElement("li"));
			aliasElem.textContent = alias;
			aliasElem.classList.add("alias");
		}
	}

	if(article.terms?.description) {
		const descriptionItem = wpRndInfoCard.appendChild(document.createElement("li"));
		descriptionItem.textContent = article.terms.description;
		descriptionItem.classList.add("desc-item");
	}
	
	//insertion in list
	const historyNew = document.createElement("li");
	historyNew.append(articleAnchor.cloneNode(true)); //reuse
	historyNew.classList.add("history-item");
	if(article.terms?.description) {
		historyNew.appendChild(document.createTextNode(" "));
		const descriptionLabel = historyNew.appendChild(document.createElement("span"));
		descriptionLabel.textContent = article.terms.description;
		descriptionLabel.classList.add("article-description");
	}
	lstWpRndHistory.prepend(historyNew);
	while(lstWpRndHistory.childElementCount > articleHistoryLimit) //truncation
		lstWpRndHistory.lastElementChild.remove();
}

var suggestions = document.getElementById('suggestions');
var search = document.getElementById('search');

const MAX_TITLE_SUGGESTION_ELEMENTS = 5;
const MAX_CONTENT_SUGGESTION_ELEMENTS = 8;
const MAX_CONTENT_SUGGESTIONS = 4;

if (search !== null) {
  document.addEventListener('keydown', inputFocus);
}

function inputFocus(e) {
  if (e.ctrlKey && e.key === '/') {
    e.preventDefault();
    search.focus();
  }
}

/*
Source:
  - https://dev.to/shubhamprakash/trap-focus-using-javascript-6a3
*/

document.addEventListener('keydown', suggestionFocus);

function suggestionFocus(e) {
  const suggestionsHidden = suggestions.classList.contains('d-none');
  if (suggestionsHidden) return;

  const focusableSuggestions = [...suggestions.querySelectorAll('a')];
  if (focusableSuggestions.length === 0) return;

  const index = focusableSuggestions.indexOf(document.activeElement);

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const nextIndex = index > 0 ? index - 1 : 0;
    focusableSuggestions[nextIndex].focus();
  }
  else if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIndex = index + 1 < focusableSuggestions.length ? index + 1 : index;
    focusableSuggestions[nextIndex].focus();
  }
}

const indexConfig = {
  tokenize: 'full',
  cache: true,
  document: {
    id: 'id',
    store: [
      'href', 'title', 'content',
    ],
    index: ['title', 'content'],
  },
};

if (window.siteLanguage === 'kor') {
  indexConfig.encode = (str) => {
    // not replacing with `str.replace(/[\x00-\x7F]/g, "").split("")` because we
    // want to mix english words with korean. For example `요소는 npm`
    return str.split('');
  };
}

const index = new FlexSearch.Document(indexConfig);

window.searchIndexReady = false;
function getBaseUrl() {
  const baseUrl = '{{.Site.BaseURL}}';
  return !baseUrl.endsWith('/') ? baseUrl : baseUrl.slice(0, -1);
}

function getSearchIndexUrl() {
  const baseUrl = getBaseUrl();
  const searchIndexUrl = window.siteLanguage ? `${window.siteLanguage}/search-index.json` : `search-index.json`;
  return `${baseUrl}/${searchIndexUrl}`;
}

const getPostsJSON = async () => {
  let response = await fetch(getSearchIndexUrl());
  let data = await response.json();
  data.forEach((el) => {
    // Remove new lines and tabs from the content because they are breaking the search results
    el.content = el.content.replace(/\n|\t/g, '');
    index.add(el);
  });
  window.searchIndexReady = true;
  document.getElementById('search').dispatchEvent(new CustomEvent('search-index-ready'));
}

getPostsJSON();

function getMatchIndices(str, tokens, limit = -1) {
  const result = [];
  let match, i = 0;

  try {
    // Remove excess whitespaces to avoid a potential process blocking regex/operation.
    // Split search query (stored in the regex variable) into tokens for more precise search results
    regex = tokens.map(token => `(${token})`).join('|');
    regex = new RegExp(`${regex}`, 'g');
  } catch (error) {
    return result;
  }

  while (match = regex.exec(str)) {
    if (limit > -1 && i >= limit) break;
    // Save the start and end index of the match result
    result.push([match.index, regex.lastIndex]);
    i++;
  }

  return result;
}

/**
 * Will hightlight the token when a description text object is created
 * @param {object} state 
 * @returns {string} - the hightlighted token
 */
function highlightWord(state) {
  let token = '';
  state.index = state.tokenPositions[0];
  const offset = state.tokenPositions[0] + (state.tokenPositions[1] - state.tokenPositions[0]);

  state.left += '<b>';

  while (state.index < offset) {
    state.left += state.description[state.index];
    token += state.description[state.index];
    state.index++;
  }

  state.left += '</b>';

  state.index = offset;

  return token;
}

/**
 * Will check if the token already can be highlighted in some generated description text based on the token positions.
 * If yes it will map the token positions in the full content to the description substring and add hightlight it.
 * Will increase the match words count and set the token as a matched one.
 * @param {Array<object>} descriptionTexts
 * @param {Array<number} tokenPositions  - Array with two values [startTokenIndex, endTokenIndex]
 * @returns 
 */
function hightlightTokenInExistingDescrition(descriptionTexts, tokenPositions) {
  const boldTagStringLength = '<b></b>'.length;
  const descriptionIndex = descriptionTexts.findIndex(({ from, to }) => tokenPositions[0] >= from && tokenPositions[1] <= to);
  if (descriptionIndex === -1) return false;

  const description = descriptionTexts[descriptionIndex];
  const tokenSize = tokenPositions[1] - tokenPositions[0];
  // To get the start index of the token in the current description we do ${realTokenStartIndex} - ${realDescriptionFromIndex}
  // and then we add the bold tag string length multiplied to the matched words in the description.
  // Like that we can hightlight the token "abc" in the description "a <b>test</b> message has abc" -> "a <b>test</b> message has <b>abc</b>"
  const startTokenIndex = (tokenPositions[0] - description.from) + (description.matchWords * boldTagStringLength);
  const endTokenIndex = startTokenIndex + tokenSize;

  let left = description.value.slice(0, startTokenIndex);
  const token = description.value.slice(startTokenIndex, endTokenIndex);
  const end = description.value.slice(endTokenIndex);

  descriptionTexts[descriptionIndex] = {
    ...description,
    value: `${left}<b>${token}</b>${end}`,
    matchWords: description.matchWords + 1,
  }
  // Save the token as a matched one if it is not.
  descriptionTexts[descriptionIndex].matchTokens.add(token.toLowerCase());
  return true;
}

/**
 * Will create a new description substring from the full one with the hightlithed token based on the token positions
 * Will add relevant information to the returned object about the matched words, matched tokens and start and end indexes of the description text
 * that are mapped to the real indexes in the full description.
 * @param {string} description 
 * @param {Array<number>} tokenPositions - Array with two values [startTokenIndex, endTokenIndex]
 * @returns 
 */
function getFoundWordFromDescription(description, tokenPositions) {
  const maxLeftSymbols = 10, maxRightSymbols = 30;
  const state = {
    left: '',
    right: '',
    index: tokenPositions[0] - 1,
    symbolsCount: 0,
    description,
    tokenPositions,
  }
  let fromIndex = state.index < 0 ? 0 : state.index;

  // Get the symbols on the left side of the matched token
  while (description[state.index] && state.symbolsCount < maxLeftSymbols) {
    state.left += description[state.index];
    fromIndex = state.index--;
    state.symbolsCount++;
  }

  state.left = state.left.split('').reverse().join('');

  const token = highlightWord(state);

  state.symbolsCount = 0;

  // Get the right side of the description text
  while (description[state.index] && state.symbolsCount < maxRightSymbols) {
    state.right += description[state.index];
    state.index++;
    state.symbolsCount++;
  }

  const toIndex = state.index - 1;
  const matchTokens = new Set([token.toLowerCase()]);

  return {
    value: (state.left + state.right).replace(/\t|\n/g, ''),
    // The real start index of the substring description text that is in the full description text.
    from: fromIndex,
    // The real end index of the substring description text that is in the full description text.
    to: toIndex,
    // How many tokens are matched (highlighted) in the description text
    matchWords: 1,
    // The tokens that are matched in this description
    matchTokens,
  };
}

function displayNoResultsElement(searchQuery) {
  const noResultsMessage = document.createElement('div')
  noResultsMessage.innerHTML = `No results for '<strong>${searchQuery}</strong>'`
  noResultsMessage.classList.add('suggestion__no-results');
  suggestions.appendChild(noResultsMessage);
  return false;
}

function constructTitleSuggestions(entries, resultTitlesIds, suggestionDescriptionClass, isLiveSearch = false) {
  for (const id of resultTitlesIds) {
    if (isLiveSearch && entries.length === MAX_TITLE_SUGGESTION_ELEMENTS) break;

    const storedEntry = index.get(id);
    const entry = document.createElement('div');
    const a = document.createElement('a');
    a.href = storedEntry.href;
    entry.appendChild(a);

    const title = document.createElement('div');
    title.textContent = storedEntry.title;
    title.classList.add('suggestion__title');
    a.appendChild(title);

    const description = document.createElement('div');
    if (storedEntry.href.indexOf('components') !== -1) {
      description.innerHTML = '<b>Components</b>';
    } else if (storedEntry.href.indexOf('examples') !== -1) {
      description.innerHTML = '<b>Examples</b>';
    } else if (storedEntry.href.indexOf('interaction manager') !== -1) {
      description.innerHTML = '<b>Interaction manager</b>';
    } else {
      description.innerHTML = storedEntry.href;
    }
    description.classList.add(suggestionDescriptionClass);
    a.appendChild(description);

    entries.push(entry);
  }
}

function constructTitle(title) {
  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  titleEl.classList.add('suggestion__title');

  return titleEl;
}

function constructAnchor(title, href) {
  const a = document.createElement('a');
  a.href = href;
  a.appendChild(title);

  return a;
}

function constructFullSearchLengthInfo(occurrences) {
  if (occurrences <= 0) return null;

  const fullResultsLengthInfo = document.createElement('span');
  fullResultsLengthInfo.style['font-size'] = '13px';
  fullResultsLengthInfo.style.display = 'inline';
  fullResultsLengthInfo.innerHTML = `[${occurrences} more occurrence${occurrences === 1 ? '' : 's'}]`;

  return fullResultsLengthInfo;
}

function constructDescription(descriptionText, fullResultsLengthInfo, suggestionDescriptionClass) {
  const description = document.createElement('div');
  description.innerHTML = descriptionText;
  if (fullResultsLengthInfo) description.appendChild(fullResultsLengthInfo);
  description.classList.add(suggestionDescriptionClass);

  return description;
}

/**
 * We compare two description texts by
 * - their token size. More tokens matched means more relevant result
 * - their closer match to the search query tokens. If the token size is the same for two records
 *   then we check which of them has more closer matched tokens to the search query. Check the closerMatchTokens description for more information.
 * @param {object} a 
 * @param {object} b 
 * @param {Array<string>} searchTokens 
 * @returns 
 */
function compareResults(a, b, searchTokens) {
  // if a description has more tokens than the next it is a more relevant result
  if (a.matchTokens.size < b.matchTokens.size) return 1;
  if (a.matchTokens.size > b.matchTokens.size) return -1;

  return closerMatchTokens(searchTokens, a, b);
}

/**
 * Used to compare two sets with matched tokens.
 * Will check if some of the sets has tokens that are closer to the search tokens.
 * 
 * For example if we search for "javascript preloading" this will prodice a search tokens array ['javascript','preloading'].
 * Then if tokensA = ['preloading'] and tokensB = ['javascript'] it will choose tokensB because 'javascript' token is before 'preloading'
 * in the search tokens array. 
 * If tokensA = ['preloading', 'javascript'] and tokensB = ['javascript', 'preloading'] then we will choose
 * tokensB as closer tokens because they are machining the same token values as in the search tokens array.
 * 
 * The order of the tokens inside tokensA and tokensB is done by the first to last found word in the content description.
 * So if we have the content "<b>immediate</b> <b>layout</b> is a great for making great <b>layout</b> <b>immediate</b>ly"
 * with search tokens - ["immediate", "layout"] or ["layout", "immediate"] then the generated tokens for the content are going to be ["immediate", "layout"]
 * because first we match "immediate", then "layout", then "layout" once again but it is already added as a token and finally "immediate" but it has been added already as well.
 * 
 * In the future we can improve this comparison.
 * @param {Array<string>} searchTokens 
 * @param {Array<string>} a 
 * @param {Array<string>} b 
 * @returns 
 */
function closerMatchTokens(searchTokens, a, b) {
  const matchTokensEntriesA = Array.from(a.matchTokens);
  const matchTokensEntriesB = Array.from(b.matchTokens);

  for (const token of searchTokens) {
    const tokenIndexA = matchTokensEntriesA.indexOf(token);
    const tokenIndexB = matchTokensEntriesB.indexOf(token);
    if (tokenIndexA > -1 && tokenIndexB < 0) return -1;
    if (tokenIndexB > -1 && tokenIndexA < 0) return 1;
    if (tokenIndexA < tokenIndexB && tokenIndexA > -1) return -1;
    if (tokenIndexA > tokenIndexB && tokenIndexB > -1) return 1;
  }

  // matchTokensCount is used when we are sorting the suggestions
  // we want suggestions that are having more closely mathed tokens to be displayed first
  // For example when we search for "live view" then two suggestions that have matched ["live", "view"] tokens in their description
  // but the first has 2 occurrences of these tokens and the second has 1 then the first has to be displayed before the second one.
  if (a.matchTokensCount && b.matchTokensCount) {
    if (a.matchTokensCount < b.matchTokensCount) return 1;
    if (a.matchTokensCount > b.matchTokensCount) return -1;
  }
  return 0;
}

function createSuggestionsUIElements(suggestions, entries, suggestionDescriptionClass, isLiveSearch) {
  for (const { restResultsLength, title, description, href } of suggestions) {
    if (isLiveSearch && entries.length === MAX_CONTENT_SUGGESTION_ELEMENTS) break;

    const fullResultsLengthInfo = constructFullSearchLengthInfo(restResultsLength);
    const descriptionEl = constructDescription(description, fullResultsLengthInfo, suggestionDescriptionClass);
    const titleEl = constructTitle(title);
    const a = constructAnchor(titleEl, href);
    const entry = document.createElement('div');
    entry.appendChild(a);

    a.appendChild(descriptionEl);
    entries.push(entry);
  }
}

function constructContentSuggestions(entries, searchTokens, resultIds, suggestionDescriptionClass, isLiveSearch = false) {
  const suggestions = [];

  for (const id of resultIds) {
    const storedEntry = index.get(id);
    const storedEntryContent = storedEntry.content;
    const allMatches = getMatchIndices(storedEntryContent.toLowerCase(), searchTokens);

    let descriptionTexts = [];

    for (const tokenPositions of allMatches) {
      // If the token exists in some description text already hightligh it there otherwise
      // create a new description text with the hightligthed token
      if (hightlightTokenInExistingDescrition(descriptionTexts, tokenPositions)) continue;

      descriptionTexts.push(getFoundWordFromDescription(storedEntryContent, tokenPositions));
    }

    // Sort the description text based on their matched tokens (more matched unique tokens in description is a better result)
    // and after that based on the matched words (more matched words in the description is a better result)
    descriptionTexts.sort((a, b) => compareResults(a, b, searchTokens));

    const restResultsLength = descriptionTexts.length - MAX_CONTENT_SUGGESTIONS;
    descriptionTexts = descriptionTexts.slice(0, MAX_CONTENT_SUGGESTIONS);
    if (!descriptionTexts.length) continue;
    // The first description should have the most relevant tokens so we assign them to the suggestion match tokens
    const mostRelevantTokens = descriptionTexts[0].matchTokens;
    const mostRelevantTokensString = Array.from(mostRelevantTokens).join(' ');
    const relevantTokensResultsCount = descriptionTexts.reduce((a, b) => {
      if (Array.from(b.matchTokens).join(' ') === mostRelevantTokensString) a += 1;
      return a;
    }, 0);

    suggestions.push({
      title: storedEntry.title,
      href: storedEntry.href,
      restResultsLength,
      matchTokens: mostRelevantTokens,
      matchTokensCount: relevantTokensResultsCount,
      description: `${descriptionTexts.map(desc => desc.value).join('...')}...`,
    });
  }

  suggestions.sort((a, b) => compareResults(a, b, searchTokens));

  createSuggestionsUIElements(suggestions, entries, suggestionDescriptionClass, isLiveSearch);
}

/**
 * 
 * @param {object} index The FlexSearch.Document object.
 * @param {string} searchQuery The input search value.
 * @param {number} [limit=500] The limit for how many documents will be searched in (+2 comming from FlexSearch). Full Search will use the default.
 * @returns 
 */
function getIndexResults(index, searchTokens, limit = 500) {
  let resultIds = new Set(), resultTitlesIds = new Set();
  let results = [];

  for (const token of searchTokens) {
    results = index.search(token, { limit: limit });

    // flatten results since index.search() returns results for each indexed field
    for (const result of results) {
      if (result.field === 'title') {
        result.result.forEach((id) => resultTitlesIds.add(id));
      } else if (result.field === 'content') {
        result.result.forEach((id) => resultIds.add(id));
      }
    }
  }

  return [Array.from(resultIds), Array.from(resultTitlesIds)];
}

function hasResultsForQuery(resultIds, resultTitlesIds, searchQuery) {
  // inform user that no results were found
  if (resultIds.length === 0 && resultTitlesIds.length === 0 && searchQuery) return displayNoResultsElement(searchQuery);

  if (searchQuery === '') return false;

  return true;
}
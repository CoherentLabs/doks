/* eslint-disable max-lines-per-function */
/* eslint-disable prefer-const */
/* eslint-disable one-var */
/* eslint-disable require-jsdoc */
/* eslint-disable indent */
/* eslint-disable linebreak-style */
/* eslint-disable no-var */
var suggestions = document.getElementById('suggestions');
var search = document.getElementById('search');

const MAX_TITLE_SUGGESTION_ELEMENTS = 5;
const MAX_CONTENT_SUGGESTION_ELEMENTS = 8;

if (search !== null) {
  document.addEventListener('keydown', inputFocus);
}

function inputFocus(e) {
  if (e.ctrlKey && e.key === '/') {
    e.preventDefault();
    search.focus();
  // eslint-disable-next-line indent
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
  tokenize: 'forward',
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
  data.forEach((el) => index.add(el));
  window.searchIndexReady = true;
  document.getElementById('search').dispatchEvent(new CustomEvent('search-index-ready'));
}

getPostsJSON();

function getMatchIndices(str, regex, limit = -1) {
  const result = [];
  let match, i = 0;

  try {
    // Remove excess whitespaces to avoid a potential process blocking regex/operation.
    regex = regex.trim().replace(/ +/g, ' ').split(' ').join('.*');
    regex = new RegExp(`(${regex})`, 'g');
  } catch (error) {
    return result;
  }

  while (match = regex.exec(str)) {
    if (limit > -1 && i >= limit) break;
    result.push(match.index);
    i++;
  }

  return result;
}

function getFoundWordFromDescription(description, value, startPosition) {
  const maxLeftSymbols = 10, maxRightSymbols = 30;
  let left = '',
    right = '',
    index = startPosition - 1,
    symbolsCount = 0;

  while (description[index] && symbolsCount < maxLeftSymbols) {
    left += description[index];
    index--;
    symbolsCount++;
  }

  left = left.split('').reverse().join('');

  index = startPosition;
  const offset = startPosition + value.length;

  left += '<b>';

  while (index < offset) {
    left += description[index];
    index++;
  }

  left += '</b>';

  index = offset;
  symbolsCount = 0;

  while (description[index] && symbolsCount < maxRightSymbols) {
    right += description[index];
    index++;
    symbolsCount++;
  }

  return (left + right).replace(/\t|\n/g, '');
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

function constructContentSuggestions(entries, searchQuery, resultIds, suggestionDescriptionClass, isLiveSearch = false, resultsLimit) {
  for (const id of resultIds) {
    if (isLiveSearch && entries.length === MAX_CONTENT_SUGGESTION_ELEMENTS) break;
    const storedEntry = index.get(id);
    const startPositions = getMatchIndices(storedEntry.content.toLowerCase(), searchQuery.toLowerCase(), resultsLimit);
    const allMatches = getMatchIndices(storedEntry.content.toLowerCase(), searchQuery.toLowerCase());

    const description = document.createElement('div');
    const a = document.createElement('a');
    const title = document.createElement('div');
    title.textContent = storedEntry.title;
    title.classList.add('suggestion__title');
    const entry = document.createElement('div');
    let descriptionText = '';
    a.href = storedEntry.href;

    for (const startPosition of startPositions) {
      descriptionText += getFoundWordFromDescription(storedEntry.content, searchQuery, startPosition) + '...';
      entries.push(entry);
      if (isLiveSearch && entries.length === MAX_CONTENT_SUGGESTION_ELEMENTS) break;
    }

    const fullResultsLengthInfo = document.createElement('span');
    fullResultsLengthInfo.style['font-size'] = '13px';
    fullResultsLengthInfo.style.display = 'inline';
    fullResultsLengthInfo.innerHTML = `[${allMatches.length} more occurrences]`;

    entry.appendChild(a);
    a.appendChild(title);
    description.innerHTML = descriptionText;
    description.appendChild(fullResultsLengthInfo);
    description.classList.add(suggestionDescriptionClass);
    a.appendChild(description);
  }
}

/**
 * 
 * @param {object} index The FlexSearch.Document object.
 * @param {string} searchQuery The input search value.
 * @param {number} [limit=500] The limit for how many documents will be searched in (+2 comming from FlexSearch). Full Search will use the default.
 * @returns 
 */
function getIndexResults(index, searchQuery, limit = 500) {
  let results = [];

  results = index.search(searchQuery, { limit: limit });

  // flatten results since index.search() returns results for each indexed field
  let resultIds = [], resultTitlesIds = [];

  for (const result of results) {
    if (result.field === 'title') {
      resultTitlesIds = result.result;
    } else if (result.field === 'content') {
      resultIds = result.result;
    }
  }

  return [resultIds, resultTitlesIds];
}

function hasResultsForQuery(resultIds, resultTitlesIds, searchQuery) {
  // inform user that no results were found
  if (resultIds.length === 0 && resultTitlesIds.length === 0 && searchQuery) return displayNoResultsElement(searchQuery);

  if (searchQuery === '') return false;

  return true;
}
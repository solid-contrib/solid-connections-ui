(function () {
  var $rdf = window.$rdf
  // common vocabs
  // var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#')
  var FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/')
  // var DCT = $rdf.Namespace('http://purl.org/dc/terms/')
  // var LDP = $rdf.Namespace('http://www.w3.org/ns/ldp#')
  // var SIOC = $rdf.Namespace('http://rdfs.org/sioc/ns#')
  var SOLID = $rdf.Namespace('http://www.w3.org/ns/solid/terms#')

  // init static elements
  var welcome = document.getElementById('welcome')
  var search = document.getElementById('search')
  var searchElement = document.getElementById('search-area')
  var clearSearch = document.getElementById('clear-search')
  var cancelViews = document.getElementsByClassName('cancel-view')
  var noUsersFound = document.getElementById('no-users')
  var user = document.getElementById('user')
  var extendedInfo = document.getElementById('extended-info')
  var actionsElement = document.getElementById('actions')
  var feedback = document.getElementById('feedback')
  var newModal = document.getElementById('new')
  var overlay = document.getElementById('overlay')
  var infoButtons = document.getElementById('info-buttons')
  var addNewBtn = document.getElementById('add-new')
  var cancelNewBtn = document.getElementsByClassName('cancel-new')
  var showNewModal = document.getElementsByClassName('show-new')
  var lookupElement = document.getElementById('lookup')
  var profileInfo = document.getElementById('profile-info')

  var Solid = require('solid')

  // ------------ LIST CONF ------------
  var connectionTemplate = '<div class="user-card center">' +
    '<div class="webid tooltip" data-tooltip="View details">' +
    '<div class="center">' +
    ' <figure class="avatar avatar-xl initials">' +
    '   <img class="picture">' +
    ' </figure>' +
    '</div>' +
    '<div class="column center">' +
    ' <div class="name"></div>' +
    ' <div class="url grey"></div>' +
    '</div>' +
    '</div>' +
  '</div>'

  var searchFields = ['name']

  var items = [
    // {
    //   name: 'John Doe',
    //   emails: ['john@doe.com'],
    //   picture: 'https://picturepan2.github.io/spectre/demo/img/avatar-1.png',
    //   webid: 'https://john.com/profile#me'
    // },
    // {
    //   name: 'Jane Doe',
    //   emails: ['jane@doe.com'],
    //   picture: 'https://picturepan2.github.io/spectre/demo/img/avatar-3.png',
    //   webid: 'https://jane.org/card#me'
    // },
    // {
    //   name: 'Adam Crow',
    //   emails: ['james@crow.com'],
    //   picture: 'https://picturepan2.github.io/spectre/demo/img/avatar-2.png',
    //   status: 'connected',
    //   webid: 'https://adam.org/card#me'
    // },
    // {
    //   name: 'Mike Smith',
    //   emails: ['m@smith.net'],
    //   initials: 'M S',
    //   picture: 'assets/images/empty.png'
    // }
  ]

  // ------------ END LIST CONF ------------

  // Search the connections list for a given value
  // @param fields {array}
  var searchList = function (fields) {
    fields = fields || searchFields
    var searchVal = document.getElementById('search').value
    if (searchVal.length > 0) {
      showElement(clearSearch)
    } else {
      hideElement(clearSearch)
    }
    if (searchVal.length >= 2) {
      uList.search(searchVal, fields)
      if (uList.visibleItems.length === 0) {
        showElement(noUsersFound)
      }
    } else {
      uList.search()
    }
  }

  var clearSearchList = function () {
    hideElement(clearSearch)
    hideElement(noUsersFound)
    search.value = ''
    uList.search()
  }

  var addConnection = function (profile) {
    showElement(lookupElement)
    showElement(infoButtons)
    if (uList.get('webid', profile.webid).length > 0) {
      addFeedback('', 'You are already connected with this person')
      return
    }
    var item = {}
    item.webid = item.url = profile.webid
    item.name = profile.name
    if (profile.picture) {
      item.picture = profile.picture
    } else {
      item.picture = 'assets/images/empty.png'
      item.initials = getInitials(profile.name)
    }
    if (profile.email) {
      item.picture = profile.picture
    }
    item.status = 'invitation sent'
    uList.add(item)
    hideElement(welcome)
    showElement(searchElement)
    showElement(actionsElement)
    // clear the info profile
    profileInfo.innerHTML = ''
    addFeedback('success', 'You have a new connection!')
    uList.sort('name', { order: 'asc' })
  }

  var deleteConnection = function (webid) {
    uList.remove('webid', webid)
    if (uList.visibleItems.length === 0) {
      hideElement(searchElement)
      hideElement(actionsElement)
      showElement(welcome)
    }
    cancelView()
  }

  // Fetch a WebID profile using Solid.js
  var findWebID = function () {
    var webid = document.getElementById('webid').value
    if (!webid || webid.length === 0) {
      console.log('No webid specified')
      addFeedback('error', 'You need to provide a WebID')
      return
    }

    showLoadingButton(addNewBtn)

    Solid.identity.getProfile(webid)
    .then(function (resp) {
      var profile = importSolidProfile(resp)
      if (!profile) {
        addFeedback('error', 'Error parsing profile data')
      }
      // clear the contents of the modal
      hideElement(lookupElement)
      hideElement(infoButtons)

      quickLook(profile, profileInfo)
      hideLoadingButton(addNewBtn)
    })
    .catch(function (err) {
      console.log('Could not load profile:', err)
      addFeedback('error', 'Could not load profile data')
      hideLoadingButton(addNewBtn)
      showElement(infoButtons)
    })
  }

  var importSolidProfile = function (data) {
    var profile = {}

    if (!data.parsedGraph) {
      return null
    }

    var g = data.parsedGraph
    var webid = data.webId
    // set webid
    profile.webid = webid

    var webidRes = $rdf.sym(webid)

    // set name
    var name = g.any(webidRes, FOAF('name'))
    if (name && name.value.length > 0) {
      profile.name = name.value
    } else {
      profile.name = ''
      // use familyName and givenName instead of full name
      var givenName = g.any(webidRes, FOAF('givenName'))
      if (givenName) {
        profile.name += givenName.value
      }
      var familyName = g.any(webidRes, FOAF('familyName'))
      if (familyName) {
        profile.name += (givenName) ? ' ' + familyName.value : familyName.value
      }
      // use nick
      if (!givenName && !familyName) {
        var nick = g.any(webidRes, FOAF('nick'))
        if (nick) {
          profile.name = nick.value
        }
      }
    }

    // set picture
    var img = g.any(webidRes, FOAF('img'))
    var pic
    if (img) {
      pic = img
    } else {
      // check if profile uses depic instead
      var depic = g.any(webidRes, FOAF('depiction'))
      if (depic) {
        pic = depic
      }
    }
    if (pic && pic.uri.length > 0) {
      profile.picture = pic.uri
    }

    var emails = g.statementsMatching(webidRes, FOAF('mbox'))
    if (emails.length > 0) {
      profile.emails = []
      emails.forEach(function (email) {
        var addr = email.object.uri
        if (addr && addr.length > 0) {
          if (addr.indexOf('mailto:') === 0) {
            addr = addr.slice(7)
          }
          profile.emails.push(addr)
        }
      })
    }

    var phones = g.statementsMatching(webidRes, FOAF('phone'))
    if (phones.length > 0) {
      profile.phones = []
      phones.forEach(function (phone) {
        var addr = phone.object.uri
        if (addr && addr.length > 0) {
          if (addr.indexOf('tel:') === 0) {
            addr = addr.slice(4)
          }
          profile.phones.push(addr)
        }
      })
    }

    var homepages = g.statementsMatching(webidRes, FOAF('homepage'))
    if (homepages.length > 0) {
      profile.homepages = []
      homepages.forEach(function (homepage) {
        var url = homepage.object.uri
        if (url && url.length > 0) {
          profile.homepages.push(url)
        }
      })
    }

    var inbox = g.any(webidRes, SOLID('inbox'))
    if (inbox) {
      profile.inbox = inbox.uri
    }

    console.log(profile)

    return profile
  }

  var viewProfile = function (webid) {
    user.classList.remove('slide-out')
    user.classList.add('slide-in')
    hideElement(actionsElement)

    extendedInfo.innerHTML = '<div class="text-center">' +
      ' <h4>Loading profile...</h4>' +
      ' <div class="loading"></div>' +
      '</div>'

    Solid.identity.getProfile(webid)
    .then(function (resp) {
      var profile = importSolidProfile(resp)
      if (!profile) {
        addFeedback('error', 'Error parsing profile data')
      }
      extendedInfo.innerHTML = ''
      extendedLook(profile, extendedInfo)
    })
    .catch(function (err) {
      console.log('Could not load profile:', err)
      addFeedback('error', 'Could not load profile data')
    })
  }

  var cancelView = function () {
    user.classList.remove('slide-in')
    user.classList.add('slide-out')
  }

  var extendedLook = function (profile, parent) {
    var card = document.createElement('div')
    card.classList.add('card', 'no-border')

    var image = document.createElement('div')
    image.classList.add('text-center')
    card.appendChild(image)

    if (profile.picture) {
      var picture = document.createElement('img')
      picture.classList.add('img-responsive', 'centered', 'circle', 'user-picture')
      picture.src = profile.picture
      image.appendChild(picture)
    }

    var body = document.createElement('div')
    card.appendChild(body)
    body.classList.add('card-body')

    if (profile.name) {
      var name = document.createElement('h4')
      name.classList.add('card-title', 'text-center')
      name.innerHTML = profile.name
      body.appendChild(name)
    }

    if (!profile.status) {
      profile.status = 'invitation sent'
    }
    var status = document.createElement('h4')
    status.classList.add('card-meta', 'text-center', 'status', 'green')
    status.innerHTML = profile.status
    body.appendChild(status)

    var section = document.createElement('div')
    var label = document.createElement('h6')
    var icon = document.createElement('i')
    icon.classList.add('fa', 'fa-envelope-o')
    label.appendChild(icon)
    label.innerHTML += ' Emails'
    section.appendChild(label)
    body.appendChild(section)

    if (profile.emails) {
      profile.emails.forEach(function (addr) {
        var div = document.createElement('div')
        div.classList.add('card-meta')
        div.innerHTML = addr
        body.appendChild(div)
      })
    } else {
      var div = document.createElement('div')
      div.classList.add('card-meta', 'grey')
      div.innerHTML = 'No email addresses found.'
      body.appendChild(div)
    }

    section = document.createElement('div')
    label = document.createElement('h6')
    icon = document.createElement('i')
    icon.classList.add('fa', 'fa-phone')
    label.appendChild(icon)
    label.innerHTML += ' Phones'
    section.appendChild(label)
    body.appendChild(section)

    if (profile.phones) {
      profile.phones.forEach(function (phone) {
        var div = document.createElement('div')
        div.classList.add('card-meta')
        div.innerHTML = phone
        body.appendChild(div)
      })
    } else {
      div = document.createElement('div')
      div.classList.add('card-meta', 'grey')
      div.innerHTML = 'No phone numbers found.'
      body.appendChild(div)
    }

    section = document.createElement('div')
    label = document.createElement('h6')
    icon = document.createElement('i')
    icon.classList.add('fa', 'fa-link')
    label.appendChild(icon)
    label.innerHTML += ' Homepages'
    section.appendChild(label)
    body.appendChild(section)

    if (profile.homepages) {
      profile.homepages.forEach(function (page) {
        var div = document.createElement('div')
        div.classList.add('card-meta')
        div.innerHTML = page
        body.appendChild(div)
      })
    } else {
      div = document.createElement('div')
      div.classList.add('card-meta', 'grey')
      div.innerHTML = 'No homepage address found.'
      body.appendChild(div)
    }

    // Actions
    var footer = document.createElement('div')
    card.appendChild(footer)
    footer.classList.add('card-footer', 'text-center')

    // // new contact button
    // var button = document.createElement('button')
    // footer.appendChild(button)
    // button.classList.add('btn', 'btn-lg', 'btn-primary')
    // button.innerHTML = 'Create contact'
    // button.addEventListener('click', function () {
    //   addConnection(profile)
    //   deleteElement(card)
    //   closeModal()
    // }, false)

    // remove button
    var remove = document.getElementById('remove')
    var removeBtn = document.createElement('div')
    remove.appendChild(removeBtn)
    removeBtn.classList.add('pointer', 'box', 'p-10', 'red')
    var removeIcon = document.createElement('i')
    removeBtn.appendChild(removeIcon)
    removeIcon.classList.add('fa', 'fa-trash-o')
    removeBtn.innerHTML += ' Remove connection'
    removeBtn.addEventListener('click', function () {
      removeDialog(profile)
    })

    // finish
    parent.appendChild(card)
  }

  var quickLook = function (profile, parent) {
    var card = document.createElement('div')
    card.classList.add('card', 'no-border')

    var image = document.createElement('div')
    card.appendChild(image)
    image.classList.add('card-image')

    if (profile.picture) {
      var picture = document.createElement('img')
      picture.classList.add('img-responsive', 'centered')
      picture.src = profile.picture
      image.appendChild(picture)
    }

    var header = document.createElement('div')
    card.appendChild(header)
    header.classList.add('card-header', 'text-center')

    if (profile.name) {
      var name = document.createElement('h4')
      name.classList.add('card-title')
      name.innerHTML = profile.name
      header.appendChild(name)
    }

    if (profile.emails) {
      var email = document.createElement('h6')
      email.classList.add('card-meta')
      email.innerHTML = profile.emails[0]
      header.appendChild(email)
    }

    var body = document.createElement('div')
    card.appendChild(body)
    body.classList.add('card-body')
    body.innerHTML = 'Would you like to connect with this person?'

    var footer = document.createElement('div')
    card.appendChild(footer)
    footer.classList.add('card-footer', 'text-right')

    var cancel = document.createElement('button')
    footer.appendChild(cancel)
    cancel.classList.add('btn', 'btn-link')
    cancel.innerHTML = 'Cancel'
    cancel.addEventListener('click', function () {
      deleteElement(card)
      showElement(lookupElement)
      showElement(infoButtons)
    }, false)

    var button = document.createElement('button')
    footer.appendChild(button)
    button.classList.add('btn', 'btn-primary')
    button.innerHTML = 'Connect'
    button.addEventListener('click', function () {
      addConnection(profile)
      deleteElement(card)
      closeModal()
    }, false)

    // finish
    parent.appendChild(card)
  }

  var getInitials = function (name) {
    var initials = ''
    if (name.length <= 2) {
      return name.toUpperCase()
    }
    if (name.indexOf(' ') >= 0) {
      var pieces = name.split(' ')
      for (var i = 0; i < pieces.length; i++) {
        if (initials.length > 0) {
          initials += ' '
        }
        initials += pieces[i][0].toUpperCase()
        if (i === 1) {
          break
        }
      }
    }
    return initials
  }

  // ------------ FEEDBACK ------------

  // Add visual feedback (toast) element to the DOM
  // @param msgType {string} one value of type [info, success, error]
  // @param msg {string} message to send
  var addFeedback = function (msgType, msg) {
    var timeout = 1500

    switch (msgType) {
      case 'success':
        msgType = 'toast-success'
        timeout = 1000
        break
      case 'error':
        msgType = 'toast-danger'
        timeout = 2000
        break
      case 'info':
        msgType = 'toast-primary'
        break
      default:
        msgType = ''
        break
    }

    var div = document.createElement('div')
    div.classList.add('toast', 'centered')
    if (msgType && msgType.length > 0) {
      div.classList.add(msgType)
    }
    var btn = document.createElement('button')
    btn.classList.add('btn', 'btn-clear', 'float-right')
    // add event listener
    btn.addEventListener('click', function () {
      clearFeedback(div)
    }, false)
    // add self-timeout
    window.setTimeout(function () {
      clearFeedback(div)
    }, timeout)
    // add the message
    div.innerHTML = msg
    // add button
    div.appendChild(btn)
    // append toast to DOM
    feedback.appendChild(div)
  }

  // Remove a feedback element
  // @param msg {string} message to send
  var clearFeedback = function (elem) {
    if (elem.parentNode) {
      elem.parentNode.removeChild(elem)
    }
  }

  // ------------ MODAL ------------
  var closeModal = function () {
    hideElement(newModal)
    hideElement(overlay)
    showElement(lookupElement)
    showElement(infoButtons)
    overlay.style.display = 'none'
  }

  var showModal = function () {
    // clear the contents of the modal
    profileInfo.innerHTML = ''
    // show modal
    showElement(newModal)
    showElement(overlay)
    overlay.style.display = 'flex'
  }

  var removeDialog = function (profile) {
    var body = document.getElementsByTagName('body')[0]
    var moverlay = document.createElement('div')
    body.appendChild(moverlay)
    moverlay.classList.add('modal-overlay', 'flex', 'center-page')
    var modal = document.createElement('div')
    moverlay.appendChild(modal)
    modal.classList.add('modal-temp', 'modal-sm')

    var container = document.createElement('div')
    modal.appendChild(container)
    container.classList.add('modal-container')
    container.setAttribute('role', 'document')

    var header = document.createElement('div')
    container.appendChild(header)
    header.classList.add('modal-header')

    var cancelTop = document.createElement('button')
    header.appendChild(cancelTop)
    cancelTop.classList.add('btn', 'btn-clear', 'float-right', 'cancel-new', 'tooltip')
    cancelTop.setAttribute('type', 'button')
    cancelTop.setAttribute('data-tooltip', 'Close')
    cancelTop.setAttribute('aria-label', 'Close')
    cancelTop.addEventListener('click', function () {
      moverlay.parentNode.removeChild(moverlay)
    }, false)

    var title = document.createElement('div')
    header.appendChild(title)
    title.classList.add('modal-title')
    title.innerHTML = 'Delete Connection'

    body = document.createElement('div')
    container.appendChild(body)
    body.classList.add('modal-body')
    body.innerHTML = '<h4 class"text-center">Are you sure you want to delete this connection?</h4>'

    var footer = document.createElement('div')
    container.appendChild(footer)
    footer.classList.add('modal-footer')

    var cancel = document.createElement('button')
    footer.appendChild(cancel)
    cancel.classList.add('btn', 'btn-link')
    cancel.innerHTML = 'Cancel'
    cancel.addEventListener('click', function () {
      moverlay.parentNode.removeChild(moverlay)
    }, false)

    var del = document.createElement('button')
    footer.appendChild(del)
    del.classList.add('btn', 'btn-primary')
    del.innerHTML = 'Yes, delete it'
    del.addEventListener('click', function () {
      header.innerHTML = ''
      footer.innerHTML = ''
      body.innerHTML = `<div class="icon-success svg text-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="72px" height="72px">
          <g fill="none" stroke="#43C47A" stroke-width="2">
            <circle cx="36" cy="36" r="35" style="stroke-dasharray:240px, 240px; stroke-dashoffset: 480px;"></circle>
            <path d="M17.417,37.778l9.93,9.909l25.444-25.393" style="stroke-dasharray:50px, 50px; stroke-dashoffset: 0px;"></path>
          </g>
        </svg>
        <h6 class="green">Success!</h6>
      </div>`

      window.setTimeout(function () {
        moverlay.parentNode.removeChild(moverlay)
      }, 1500)

      deleteConnection(profile.webid)
    }, false)
  }

  // ------------ UTILITY ------------
  var hideElement = function (elem) {
    if (elem) {
      elem.classList.add('hidden')
    }
  }

  var showElement = function (elem) {
    if (elem) {
      elem.classList.remove('hidden')
    }
  }

  var deleteElement = function (elem) {
    if (elem.parentNode) {
      elem.parentNode.removeChild(elem)
    }
  }

  var showLoadingButton = function (elem) {
    elem.classList.add('loading')
  }

  var hideLoadingButton = function (elem) {
    elem.classList.remove('loading')
  }

  // ------------ EVENT LISTENERS ------------

  // search event listener
  search.addEventListener('keyup', function () {
    searchList()
  }, false)

  clearSearch.addEventListener('click', function () {
    clearSearchList()
  }, false)

  for (var i = 0; i < showNewModal.length; i++) {
    showNewModal[i].addEventListener('click', function () {
      showModal()
    }, false)
  }

  for (i = 0; i < cancelViews.length; i++) {
    cancelViews[i].addEventListener('click', function () {
      cancelView()
    }, false)
  }

  addNewBtn.addEventListener('click', function () {
    findWebID()
  }, false)

  // close modal clicks
  for (i = 0; i < cancelNewBtn.length; i++) {
    cancelNewBtn[i].addEventListener('click', function () {
      closeModal()
    }, false)
  }

  // Init
  var listOptions = {
    listClass: 'connections-list',
    searchClass: 'search-connection',
    valueNames: [
      'name',
      'status',
      'url',
      { attr: 'id', name: 'webid', evt: { action: 'click', fn: viewProfile } },
      { attr: 'src', name: 'picture' },
      { attr: 'class', name: 'image' },
      { attr: 'href', name: 'link' },
      { attr: 'data-initial', name: 'initials' }
    ],
    item: connectionTemplate
  }

  var uList = new window.List('connections', listOptions, items)
  if (uList.visibleItems.length === 0) {
    showElement(welcome)
  } else {
    showElement(searchElement)
    showElement(actionsElement)
    uList.sort('name', { order: 'asc' })
  }

  // public methods
  return {
    addFeedback: addFeedback
  }
})()

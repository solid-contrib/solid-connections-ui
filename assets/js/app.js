var Connections = Connections || {}

Connections = (function () {
  var $rdf = window.$rdf

  // constants
  const appContainer = 'connections'
  const appOrigin = window.location.origin
  const appUrl = appOrigin + window.location.pathname

  // init static elements
  // var signinUrl = document.getElementById('signin-app')
  var signin = document.getElementById('signin')
  var signinBtn = document.getElementById('signin-btn')
  var signupBtn = document.getElementById('signup-btn')
  var signoutBtn = document.getElementById('signout')
  var status = document.getElementById('status')
  var welcome = document.getElementById('welcome')
  var start = document.getElementById('start')
  var search = document.getElementById('search')
  var searchElement = document.getElementById('search-area')
  var clearSearch = document.getElementById('clear-search')
  var cancelViews = document.getElementsByClassName('cancel-view')
  var noUsersFound = document.getElementById('no-users')
  var user = document.getElementById('user')
  var connections = document.getElementById('connections')
  var extendedInfo = document.getElementById('extended-info')
  var actionsElement = document.getElementById('actions')
  var feedback = document.getElementById('feedback')
  var newModal = document.getElementById('new')
  var overlay = document.getElementById('overlay')
  var infoButtons = document.getElementById('info-buttons')
  var addNewBtn = document.getElementById('add-new')
  var inviteBtn = document.getElementById('invitebtn')
  var cancelNewBtn = document.getElementsByClassName('cancel-new')
  var showNewModal = document.getElementsByClassName('show-new')
  var lookupElement = document.getElementById('lookup')
  var profileInfo = document.getElementById('profile-info')
  var loginButtons = document.getElementById('login-buttons')
  var accountURI = document.getElementById('account')
  var doSigninBtn = document.getElementById('dosignin')
  var cancelSignInBtn = document.getElementById('cancelsignin')

  var SolidClient = window.SolidClient

  var twinqlEndpoint = 'https://databox.me/,query'
  var proxyEndpoint = 'https://databox.me/,proxy?uri='

  // User object
  var User = {}

  // Map of connections
  var Connections = {}

  // ------------ URL QUERY VALUES ------------
  // Map URL query items to their values
  // e.g. ?referrer=https... -> queryVals[referrer] returns 'https...'
  var queryVals = (function (a) {
    if (a === '') return {}
    var b = {}
    for (var i = 0; i < a.length; ++i) {
      var p = a[i].split('=', 2)
      if (p.length === 1) {
        b[p[0]] = ''
      } else {
        b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, ' '))
      }
    }
    return b
  })(window.location.search.substr(1).split('&'))

  // ------------ LIST CONF ------------
  var connectionTemplate = '<div class="user-card pointer center">' +
    '<div class="webid tooltip" data-tooltip="View details">' +
    '<div class="center">' +
    ' <figure class="avatar avatar-xl">' +
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
  var items = []

  // ------------ END LIST CONF ------------

  var redirTo = function() {
    return appOrigin + window.location.pathname + window.location.search
  }

  // Send a twinql query and return a promise containing JSON-LD
  var twinqlQuery = function (query) {
    return new Promise(function (resolve, reject) {
      if (query.length === 0) {
        var noquery = {
          msg: 'No query to submit',
          status: 0
        }
        return reject(noquery)
      }
      var req = new window.XMLHttpRequest()

      // define onload behavior
      req.onload = function (e) {
        return resolve(req.responseText)
      }
      // define onerror behavior
      req.onerror = function (e) {
        var err = {
          msg: e.statusText,
          status: e.status
        }
        return reject(err)
      }
      var endpoint = (User.queryEndpoint) ? User.queryEndpoint : queryEndpoint
      req.open('POST', endpoint)
      req.setRequestHeader('Content-Type', 'text/tql')
      req.setRequestHeader('Authorization', 'Bearer ' + User.authkey)
      req.send(query)
    }).catch(function (err) {
      throw new Error('Something went wrong in the twinql request: ' + err)
    })
  }

  var loadUser = function (query) {
    return new Promise(function (resolve, reject) {
      if (query.length === 0) {
        // deal with the exception
        return reject('No query was provided')
      }
      twinqlQuery(query).then(function (data) {
        var profile = loadProfile(JSON.parse(data))
        return resolve(profile)
      }).catch(function (err) {
        console.log(err)
      })
    })
  }

  // Load my friends
  var loadExtendedUser = function (webid, callback) {
    if (webid.length === 0) {
      // deal with the exception
      return
    }
    status.innerHTML = newStatus('Loading social graph...')
    var profileTemplate = `
      foaf:name
      foaf:givenName
      foaf:familyName
      foaf:nick
      foaf:img
      foaf:depiction
      ui:backgroundImage
      [ foaf:mbox ]
      [ foaf:homepage ]
      solid:inbox`
    var query = `@prefix foaf http://xmlns.com/foaf/0.1/
      @prefix solid http://www.w3.org/ns/solid/terms#
      @prefix ui http://www.w3.org/ns/ui#

      ${webid} {
        ${profileTemplate}
        [ foaf:knows ] {
          ${profileTemplate}
        }
      }`

    loadUser(query).then(function (profile) {
      // Add to list of connections
      Connections[profile.webid] = profile
      var display = (callback)?false:true
      listFriends(profile, display)
      if (callback) {
        callback()
      }
    }).catch(function (err) {
      console.log(err)
    })
  }

  // -------------- SEARCH LIST --------------
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
      hideElement(noUsersFound)
      uList.search()
    }
  }

  // Reset/clear search field and show/hide elements
  var clearSearchList = function () {
    hideElement(clearSearch)
    hideElement(noUsersFound)
    search.value = ''
    uList.search()
  }

  // Display list of friends
  var listFriends = function (profile, display) {
    hideElement(signin)
    profile.friends = []
    if (!profile.knows || profile.knows.length === 0) {
      status.innerHTML = ''
      showElement(start)
      showElement(searchElement)
      return
    }
    profile.knows.filter(function(friend) {
      return !friend['@error'] && friend['foaf:name'] && friend['@id'].indexOf('http') >= 0
    }).forEach(function (friend) {
      var item = loadProfile(friend)
      profile.friends.push(item)
      Connections[item.webid] = item
      if (display) {
        showElement(searchElement)
        showElement(actionsElement)
        addToList(item, 'name', 'asc', uList, false)
      }
    })
    Connections[profile.webid] = profile
  }

  // Add a new connection to the index document
  // @param profile {object} Contains fields contained in the index document
  // @param isPublic {bool} If true, add the connection to the public index instead
  var addConnection = function (profile, goBack) {
    // var indexType = (isPublic) ?
    return new Promise(function(resolve, reject) {
      var g = $rdf.graph()
      var webid = $rdf.sym(User.webid)
      g.add(
        webid,
        SolidClient.vocab.foaf('knows'),
        $rdf.sym(profile.webid)
      )
      var toAdd = []
      var toDel = null
      profile.graph = g.statementsMatching(webid, undefined, undefined)
      profile.graph.forEach(function (st) {
        toAdd.push(st.toNT() + ' .') // remove this once Solid.js is fixed
      })

      SolidClient.web.patch(proxy(User.webid), toDel, toAdd)
        .then(function () {
          // Update the profile object with the new registry without reloading
          addToList(profile, 'name', 'asc', uList, false)
          // add to my friends
          if (Connections[User.webid]) {
            Connections[User.webid].friends.push(profile)
          }
          // send a notification to the user's inbox
          if (profile.inbox && profile.inbox.length > 0) {
            console.log('Sending notification to inbox', profile.inbox)
            var link = appUrl + '?referrer=' + encodeURIComponent(User.webid)
            var title = 'New friend'
            var content = User.name + ' has just connected with you!' +
                        ' Click here to connect with this person -- ' + link
            sendNotification(profile.inbox, title, content)
          }
          // show success sign
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

          mbody = document.createElement('div')
          container.appendChild(mbody)
          mbody.classList.add('modal-body')
          mbody.innerHTML = successCheckMark("Friend added!")
          window.setTimeout(function () {
            moverlay.parentNode.removeChild(moverlay)
          }, 1000)

          if (goBack) {
            cancelView()
            closeModal()
          }
          return resolve(profile)
        })
        .catch(function (err) {
          console.log('Error saving new contact:' + err)
          addFeedback('error', 'Error saving new contact')
          return reject(err)
        })
      })
  }

  // Add the new connection to the list and sort the list
  // @param profile {object} Contains fields contained in the index document
  // @param sort {string} Value to use for sorting (name, email, etc.)
  // @param order {string} Value to use for ordering (asc / desc)
  // @param verbose {bool} If true, show feedback to the user
  var addToList = function (profile, sort, order, toList, verbose) {
    sort = sort || 'name'
    order = order || 'asc'

    if (toList.get('webid', profile.webid).length > 0) {
      if (verbose) {
        addFeedback('', 'You are already connected with this person')
      }
      return
    }
    var item = {}
    item.webid = item.url = profile.webid
    item.name = profile.name
    if (profile.picture) {
      item.picture = profile.picture
    } else {
      item.picture = 'assets/images/avatar.png'
    }
    if (profile.email) {
      item.email = profile.email
    }
    item.status = profile.status || 'invitation sent'
    // Add to UI list
    if (toList.get('webid', item.webid).length > 0) {
      // avoid adding the same person twice
      toList.remove('webid', item.webid)
    }
    toList.add(item)
    //
    hideElement(welcome)
    // clear the info profile
    profileInfo.innerHTML = ''
    if (verbose) {
      showElement(searchElement)
      showElement(actionsElement)
      //
      // showElement(lookupElement)
      // showElement(infoButtons)

      addFeedback('success', 'You have a new friend!')
    }
    toList.sort(sort, { order: order })
  }

  var successCheckMark = function(msg) {
    return `<div class="icon-success svg text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="72px" height="72px">
            <g fill="none" stroke="#43C47A" stroke-width="2">
              <circle cx="36" cy="36" r="35" style="stroke-dasharray:240px, 240px; stroke-dashoffset: 480px;"></circle>
              <path d="M17.417,37.778l9.93,9.909l25.444-25.393" style="stroke-dasharray:50px, 50px; stroke-dashoffset: 0px;"></path>
            </g>
          </svg>
          <h6 class="green">${msg}</h6>
        </div>`
  }

  // Remove a connection
  var removeConnection = function (webid, parentElem) {
    var toAdd = null
    var toDel = []

    var g = $rdf.graph()
    var me = $rdf.sym(User.webid)
    g.add(
      me,
      SolidClient.vocab.foaf('knows'),
      $rdf.sym(webid)
    )
    g.statementsMatching(me, undefined, undefined).forEach(function (st) {
      toDel.push(st.toNT() + ' .')
    })
    SolidClient.web.patch(proxy(User.webid), toDel, toAdd).then(function () {
      if (parentElem) {
        parentElem.getElementsByClassName('modal-header')[0].innerHTML = ''
        parentElem.getElementsByClassName('modal-footer')[0].innerHTML = ''
        parentElem.getElementsByClassName('modal-body')[0].innerHTML = successCheckMark("Friend removed!")
        window.setTimeout(function () {
          parentElem.parentNode.removeChild(parentElem)
        }, 1000)
      }

      // Remove the connection from the local list
      delete Connections[webid]
      if (User.webid && Connections[User.webid]) {
        Connections[User.webid].friends = Connections[User.webid].friends.filter(function(friend) {
          return friend['webid'] !== webid
        })
        Connections[User.webid].knows = Connections[User.webid].knows.filter(function(friend) {
          return friend['@id'] !== webid
        })
      }
      // Remove the UI element
      uList.remove('webid', webid)
      if (uList.size() === 0) {
        showElement(start)
      }
      cancelView()
    })
    .catch(function (err) {
      console.log(err)
      addFeedback('error', 'Could not remove friend from your profile. Server error.')
    })
  }

  // Handle connect back case
  var connectBack = function (webid) {
    document.getElementById('webid').value = webid
    showModal()
    findWebID()
    // showList(User.webid)
  }

  var getId = function(arr) {
    if (!arr) {
      return []
    }
    if (arr.length === 0) {
      return []
    }
    var ret = []
    arr.forEach(function (id) {
      if (id['@id']) {
        ret.push(id['@id'])
      }
    })
    return ret
  }

  var getValue = function(item) {
    if (!item || item.length === 0) {
      return ""
    }
    if (item['@value'] && item['@value'].length > 0) {
      return item['@value']
    }
    return item
  }

  // Fetch a WebID profile using twinql
  var findWebID = function () {
    var webid = document.getElementById('webid').value
    if (!webid || webid.length === 0) {
      console.log('No webid specified')
      addFeedback('error', 'You need to provide a WebID')
      return
    }

    showLoadingButton(addNewBtn)

    var profileTemplate = `
      foaf:name
      foaf:givenName
      foaf:familyName
      foaf:nick
      foaf:img
      ui:backgroundImage
      [ foaf:mbox ]
      [ foaf:homepage ]
      solid:inbox`
    var query = `@prefix foaf http://xmlns.com/foaf/0.1/
      @prefix solid http://www.w3.org/ns/solid/terms#
      @prefix ui http://www.w3.org/ns/ui#

      ${webid} {
        ${profileTemplate}
      }`

    loadUser(query).then(function (profile) {
      // clear the contents of the modal
      hideElement(lookupElement)
      hideElement(infoButtons)
      hideLoadingButton(addNewBtn)

      quickLook(profile, profileInfo)
    }).catch(function (err) {
      console.log('Could not load profile:', err)
      addFeedback('error', 'Could not load profile data')
      hideLoadingButton(addNewBtn)
      showElement(infoButtons)
    })
  }

  var loadProfile = function (data) {
    if (data.length === 0) {
      return null
    }
    var webid = data['@id']

    var profile = Connections[webid]||{}

    var err = data['@error']
    if (err) {
      console.log(data)
      return profile
    }

    // set webid
    profile.webid = data['@id']
    profile.knows = data['foaf:knows']||[]
    if (data['foaf:img']) {
      var img = data['foaf:img']['@id']
      profile.picture = (img.indexOf('http') >= 0)?proxy(img):img
    } else if (data['foaf:depiction']) {
      var img = data['foaf:depiction']['@id']
      profile.picture = (img.indexOf('http') >= 0)?proxy(img):img
    } else {
      profile.picture = 'assets/images/avatar.png'
    }
    profile.background = ''
    if (data['ui:backgroundImage']) {
      profile.background = proxy(data['ui:backgroundImage']['@id'])
    }
    var name = getValue(data['foaf:name'])
    var fn = getValue(data['foaf:familyName'])
    var gn = getValue(data['foaf:givenName'])
    if (name.length > 0) {
      profile.name = name
    } else {
      profile.name = ''
      if (gn.length > 0) {
        profile.name += gn
      }
      if (fn.length > 0) {
        profile.name += ' ' + fn
      }
    }
    profile.emails = getId(data['foaf:mbox'])||[]
    profile.homepages = getId(data['foaf:homepage'])||[]
    profile.inbox = (data['solid:inbox'])?proxy(data['solid:inbox']['@id']):''
    return profile
  }

  var proxy = function(uri) {
    var endpoint = proxyEndpoint
    if (User.proxyEndpoint) {
      endpoint = User.proxyEndpoint
    }
    return endpoint + encodeURIComponent(uri) + "&key="+encodeURIComponent(User.authkey)
  }

  var viewAndPush = function (webid) {
    // push new state to the URL bar
    pushState('view', webid)
    viewProfile(webid)
  }

  var viewProfile = function (webid) {
    showElement(user)
    user.classList.remove('slide-out')
    user.classList.add('slide-in')

    connections.classList.remove('fade-in')
    connections.classList.add('fade-out')
    hideElement(actionsElement)

    extendedInfo.innerHTML = newStatus('Loading profile data...')

    extendedInfo.innerHTML = ''

    if (Connections[webid]) {
      extendedLook(webid, extendedInfo)
    } else {
      // load profile first
      loadExtendedUser(webid, function() {
        extendedLook(webid, extendedInfo)
      })
    }

  }

  var cancelView = function (changeState) {
    status.innerHTML = ''
    user.classList.remove('slide-in')
    user.classList.add('slide-out')
    hideElement(user)

    if (uList.visibleItems.length === 0) {
      hideElement(actionsElement)
      showElement(welcome)
    } else {
      showElement(actionsElement)
      showElement(connections)
      connections.classList.add('fade-in')
      connections.classList.remove('fade-out')
    }

    if (changeState) {
      // push new state
      if (!User.webid) {
        signUserOut()
      } else {
      // push new state
        pushState('list', User.webid)
      }
    }
  }

  var extendedLook = function (webid, parent) {
    // hide list of connections-list
    hideElement(connections)
    // hide other buttons
    hideElement(actionsElement)
    var card = document.createElement('div')
    card.classList.add('card', 'no-border')

    if (!Connections[webid]) {
      showElement(actionsElement)
      extendedInfo.innerHTML = 'Something went wrong.<br>Cannot load profile for' + webid
    }

    var profile = Connections[webid]

    // scroll whole page into view
    window.setTimeout(function () {
      search.scrollIntoView()
    }, 0)

    var image = document.createElement('div')
    image.classList.add('text-center')
    card.appendChild(image)

    // Background picture
    if (profile.background) {
      var bg = document.createElement('div')
      image.appendChild(bg)
      bg.classList.add('bg-pic')
      bg.style.backgroundImage = 'url('+profile.background+')'
    }

    // Picture
    if (profile.picture) {
      var picture = document.createElement('img')
      picture.classList.add('img-responsive', 'centered', 'circle', 'user-picture')
      picture.setAttribute('alt', profile.name + '\'s picture')
      picture.src = profile.picture
      image.appendChild(picture)
    }

    var body = document.createElement('div')
    card.appendChild(body)
    body.classList.add('card-body')

    // Name
    if (profile.name) {
      var name = document.createElement('h4')
      name.classList.add('card-title', 'text-center')
      name.innerHTML = profile.name
      body.appendChild(name)
    }

    // WebID
    var section = document.createElement('div')
    var label = document.createElement('h5')
    var icon = document.createElement('i')
    icon.classList.add('fa', 'fa-user')
    label.appendChild(icon)
    label.innerHTML += ' WebID'
    section.appendChild(label)
    body.appendChild(section)

    var div = document.createElement('div')
    div.classList.add('card-meta')
    div.innerHTML = ahref(profile.webid)
    body.appendChild(div)

    // Emails
    section = document.createElement('div')
    label = document.createElement('h5')
    icon = document.createElement('i')
    icon.classList.add('fa', 'fa-envelope-o')
    label.appendChild(icon)
    label.innerHTML += ' Emails'
    section.appendChild(label)
    body.appendChild(section)

    if (profile.emails && profile.emails.length > 0) {
      profile.emails.forEach(function (addr) {
        addr = cleanMail(addr)
        div = document.createElement('div')
        div.classList.add('card-meta')
        div.innerHTML = addr
        body.appendChild(div)
      })
    } else {
      div = document.createElement('div')
      div.classList.add('card-meta', 'grey')
      div.innerHTML = 'No email addresses found.'
      body.appendChild(div)
    }

    // Homepages
    section = document.createElement('div')
    label = document.createElement('h5')
    icon = document.createElement('i')
    icon.classList.add('fa', 'fa-link')
    label.appendChild(icon)
    label.innerHTML += ' Homepages'
    section.appendChild(label)
    body.appendChild(section)

    if (profile.homepages && profile.homepages.length > 0) {
      profile.homepages.forEach(function (page) {
        var div = document.createElement('div')
        div.classList.add('card-meta')
        div.innerHTML = ahref(page)
        body.appendChild(div)
      })
    } else {
      div = document.createElement('div')
      div.classList.add('card-meta', 'grey')
      div.innerHTML = 'No homepage addresses found.'
      body.appendChild(div)
    }

    // Friends
    section = document.createElement('div')
    label = document.createElement('h5')
    icon = document.createElement('i')
    icon.classList.add('fa', 'fa-users')
    label.appendChild(icon)
    label.innerHTML += ' Friends'
    section.appendChild(label)
    body.appendChild(section)

    var loading = document.createElement('div')
    section.appendChild(loading)
    loading.innerHTML = newStatus('Loading friends list...')

    loadExtendedUser(profile.webid, function() {
      section.removeChild(loading)
      if (profile.friends && profile.friends.length > 0) {
        profile.friends.forEach(function (friend) {
          var div = listFriend(friend)
          body.appendChild(div)
        })
      } else {
        div = document.createElement('div')
        div.classList.add('card-meta', 'grey')
        div.innerHTML = 'No friends found.'
        body.appendChild(div)
      }
    })

    // Actions
    var footer = document.createElement('div')
    card.appendChild(footer)
    footer.classList.add('card-footer', 'text-center')

    // remove button
    var addremove = document.getElementById('addremove')
    addremove.innerHTML = ''
    var addRemoveBtn = document.createElement('button')
    addremove.appendChild(addRemoveBtn)
    addRemoveBtn.classList.add('btn', 'btn-link')
    var addRemoveIcon = document.createElement('i')
    addRemoveBtn.appendChild(addRemoveIcon)

    if (User && User.webid) {
      if (isFriend(profile.webid)) {
        // remove option
        addRemoveIcon.classList.add('fa', 'fa-trash-o')
        addRemoveBtn.innerHTML += ' Remove friend'
        addRemoveBtn.addEventListener('click', function () {
          removeDialog(profile)
        })
      } else {
        // add option
        addRemoveIcon.classList.add('fa', 'fa-user-plus')
        addRemoveBtn.innerHTML += ' Add friend'
        addRemoveBtn.addEventListener('click', function () {
          addConnection(profile)
        })
      }
    }

    // finish
    parent.appendChild(card)
  }

  var isFriend = function(webid) {
    if (Connections[User.webid] && Connections[User.webid].friends.find(function(knows) {
          return knows['webid'] === webid
        })) {
        {
          return true
      }
    }
    return false
  }
  window.isFriend = isFriend

  var listFriend = function(friend) {
    var friendItem = document.createElement('div')
    friendItem.classList.add('card-meta')

    var uc = document.createElement('div')
    friendItem.appendChild(uc)
    uc.classList.add('user-card-s', 'pointer', 'center')

    var wt = document.createElement('div')
    uc.appendChild(wt)
    wt.classList.add('webid')
    wt.id = friend.webid

    var iw = document.createElement('div')
    wt.appendChild(iw)
    iw.classList.add('center')

    var fig = document.createElement('figure')
    iw.appendChild(fig)
    fig.classList.add('avatar', 'avatar-s')

    var img = document.createElement('img')
    fig.appendChild(img)
    img.classList.add('picture')
    img.src = friend.picture
    img.setAttribute('alt', 'Picture of '+friend.name)

    var info = document.createElement('div')
    wt.appendChild(info)
    info.classList.add('column', 'center', 'trunc', 'tooltip')
    info.setAttribute('data-tooltip', 'View details')
    info.addEventListener('click', function () {
      // push new state to the URL bar
      pushState('view', friend.webid)
      viewProfile(friend.webid)
    }, false)

    var name = document.createElement('div')
    info.appendChild(name)
    name.classList.add('name-s')
    name.innerHTML = friend.name

    var webid = document.createElement('div')
    info.appendChild(webid)
    webid.classList.add('url', 'grey')
    webid.innerHTML = friend.webid

        // friend status
    var addDiv = document.createElement('div')
    wt.appendChild(addDiv)
    addDiv.classList.add('center', 'center-text', 'p-l-10')
    if (User && User.webid && !isFriend(friend.webid)) {
      var addBtn = document.createElement('a')
      addDiv.appendChild(addBtn)
      var addIcon = document.createElement('i')
      addBtn.appendChild(addIcon)
      addIcon.classList.add('fa', 'fa-2x', 'fa-user-plus')
      addBtn.addEventListener('click', function () {
        addConnection(friend).then(function() {
          addDiv.removeChild(addBtn)
          addDiv.innerHTML = '<small class="green">Friends</small>'
        }).catch(function(err) {
          // already printed error to console
        })
      }, false)
    } else {
      addDiv.innerHTML = '<small class="green">Friends</small>'
    }

    return friendItem
  }

  var quickLook = function (profile, parent) {
    console.log("Taking a quick look at", profile.name)
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
      var email = document.createElement('h5')
      email.classList.add('card-meta')
      if (profile.emails[0] && profile.emails[0].length > 0) {
        email.innerHTML = cleanMail(profile.emails[0])
      }
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
      addConnection(profile, true).then(function() {
        cancelView()
        pushState('list', User.webid)
        showList(User.webid)
      }).catch(function(err) {
        //
      })
      deleteElement(card)
      closeModal()
    }, false)

    // append to parent
    parent.appendChild(card)
  }

  // create invitation link
  var getInvitationLink = function() {
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

    var mhead = document.createElement('div')
    container.appendChild(mhead)
    mhead.classList.add('modal-header')

    var mclose = document.createElement('button')
    mhead.appendChild(mclose)
    mclose.classList.add('btn', 'btn-clear', 'float-right')
    mclose.setAttribute('aria-label', 'Close invitation modal')
    mclose.addEventListener('click', function () {
      deleteElement(moverlay)
    }, false)

    var mtitle = document.createElement('div')
    mhead.appendChild(mtitle)
    mtitle.classList.add('modal-title')
    mtitle.innerHTML = 'You can use this link to invite someone to be your friend.'

    var mbody = document.createElement('div')
    container.appendChild(mbody)
    mbody.classList.add('modal-body')
    mbody.innerHTML = ''

    var it = document.createElement('input')
    mbody.appendChild(it)
    it.classList.add('form-input')
    it.type = "text"
    it.value = appUrl + '?invited='+encodeURIComponent(User.webid)
    window.setTimeout(function () {
      it.select()
    }, 0)
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

  var cleanMail = function(addr) {
    if (addr && addr.length > 0 && addr.indexOf('mailto:') >= 0) {
      addr = addr.slice(7, addr.length)
    }
    return addr
  }

  // ------------ NOTIFICATIONS ------------
  var sendNotification = function (inbox, title, content) {
    var g = $rdf.graph()
    var date = new Date().toISOString()
    g.add($rdf.sym(''), SolidClient.vocab.rdf('type'), SolidClient.vocab.solid('Notification'))
    g.add($rdf.sym(''), SolidClient.vocab.dct('title'), $rdf.lit(title))
    g.add($rdf.sym(''), SolidClient.vocab.dct('created'), $rdf.lit(date, '', $rdf.NamedNode.prototype.XSDdateTime))
    g.add($rdf.sym(''), SolidClient.vocab.sioc('content'), $rdf.lit(content))
    g.add($rdf.sym(''), SolidClient.vocab.sioc('has_creator'), $rdf.sym('#author'))

    g.add($rdf.sym('#author'), SolidClient.vocab.rdf('type'), SolidClient.vocab.sioc('UserAccount'))
    g.add($rdf.sym('#author'), SolidClient.vocab.sioc('account_of'), $rdf.sym(User.webid))
    if (User.name) {
      g.add($rdf.sym('#author'), SolidClient.vocab.foaf('name'), $rdf.lit(User.name))
    }
    if (User.picture) {
      g.add($rdf.sym('#author'), SolidClient.vocab.sioc('avatar'), $rdf.sym(User.picture))
    }

    var data = new $rdf.Serializer(g).toN3(g)
    SolidClient.web.post(inbox, data)
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
    moverlay.setAttribute('id', 'delete-dialog')
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
    title.innerHTML = 'Remove Friend'

    body = document.createElement('div')
    container.appendChild(body)
    body.classList.add('modal-body')
    body.innerHTML = '<h4 class"text-center">Are you sure you want to remove this friend?</h4>'

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
    del.innerHTML = 'Yes, remove friend'
    del.addEventListener('click', function () {
      removeConnection(profile.webid, moverlay)
    }, false)
  }

  // // ------------ Local Storage ------------
  // var saveLocalUser = function (data) {
  //   try {
  //     window.localStorage.setItem(appUrl + 'userInfo', JSON.stringify(data))
  //   } catch (err) {
  //     console.log(err)
  //   }
  // }
  // // load localstorage config data
  // var loadLocalUser = function () {
  //   try {
  //     var data = JSON.parse(window.localStorage.getItem(appUrl + 'userInfo'))
  //     if (data) {
  //       return data
  //     }
  //   } catch (err) {
  //     console.log(err)
  //   }
  // }

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

  var newStatus = function (msg) {
    return '<div class="text-center">' +
    ' <h4>' + msg + '</h4>' +
    ' <div class="loading"></div>' +
    '</div>'
  }

  // ------------ PUSH STATE ------------
  var pushState = function(route, value) {
    var title = document.getElementsByTagName('title')[0].innerHTML
    if (route && value) {
      var state = {
        'route': route,
        'value': value
      }
      window.history.pushState(state, document.querySelector('title').value,
        window.location.pathname+"?"+route+"="+encodeURIComponent(value))
    } else {
      window.history.pushState("", document.querySelector('title').value,
        window.location.pathname)
    }
  }

  // ------------ EVENT LISTENERS ------------
  // listen to Back button events
  window.addEventListener('popstate', function(e) {
    console.log(e)
    queryVals = {}
    if (e.state) {
      queryVals[e.state.route] = e.state.value
    }
    console.log(queryVals)
    route()
    // e.state is equal to the data-attribute of the last image we clicked
  });

  // sign in/up button
  accountURI.addEventListener('keyup', function(e) {
    if (e.keyCode === 13) {
      signUserIn()
    }
  }, false)
  doSigninBtn.addEventListener('click', function () {
    signUserIn()
  }, false)
  signinBtn.addEventListener('click', function () {
    window.setTimeout(function () {
      accountURI.focus()
      accountURI.scrollIntoView()
    }, 0)
    window.accountURI = accountURI
    prepareSignIn()
  }, false)

  signupBtn.addEventListener('click', function () {
    signUserUp()
  }, false)

  signoutBtn.addEventListener('click', function () {
    signUserOut()
  }, false)

  cancelSignInBtn.addEventListener('click', function () {
    resetApp()
  }, false)

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
      cancelView(true)
    }, false)
  }

  addNewBtn.addEventListener('click', function () {
    findWebID()
  }, false)

  inviteBtn.addEventListener('click', function () {
    getInvitationLink()
  }, false)

  // close modal clicks
  for (i = 0; i < cancelNewBtn.length; i++) {
    cancelNewBtn[i].addEventListener('click', function () {
      closeModal()
    }, false)
  }

  // signin postMessage
  // signinUrl.src = 'http://localhost:9000/?app=' + encodeURIComponent(appUrl) +
    // '&origin=' + encodeURIComponent(appOrigin)

  // var eventMethod = window.addEventListener
  //       ? 'addEventListener'
  //       : 'attachEvent'
  // var eventListener = window[eventMethod]
  // var messageEvent = eventMethod === 'attachEvent'
  //       ? 'onmessage'
  //       : 'message'
  // var receiveMessage = function (event) {
  //   console.log('Child message:', event.data)
  // }
  // eventListener(messageEvent, receiveMessage, true)
  //
  // var postMessage = function (msg) {
  //   signinUrl.contentWindow.postMessage(msg, '*')
  // }

  // Init
  var listOptions = {
    listClass: 'connections-list',
    searchClass: 'search-connection',
    valueNames: [
      'name',
      'status',
      'url',
      { attr: 'id', name: 'webid', evt: { action: 'click', fn: viewAndPush } },
      { attr: 'src', name: 'picture' },
      { attr: 'class', name: 'image' },
      { attr: 'href', name: 'link' },
      { attr: 'data-initial', name: 'initials' }
    ],
    item: connectionTemplate
  }

  var uList = new window.List('connections', listOptions, items)

  // INIT APP
  var initApp = function (webid) {
    hideElement(user)
    hideElement(signin)
    showElement(welcome)
    showElement(connections)
    connections.classList.add('fade-in')
    connections.classList.remove('fade-out')

    // Set the current user and show the list of friends
    User = User || {}
    User.webid = webid
    // save local user
    saveLocalStorage(User)
    // push state
    pushState('list', User.webid)
    // show list
    showList(webid)
  }

  var showList = function(webid, skipLoad) {
    hideElement(signin)

    // clear list
    uList.clear()
    uList = new window.List('connections', listOptions, items)
    window.uList = uList

    if (!skipLoad) {
      loadExtendedUser(webid)
    }

    if (uList.visibleItems.length === 0) {
      showElement(welcome)
    } else {
      showElement(searchElement)
      showElement(actionsElement)
      uList.sort('name', { order: 'asc' })
    }
  }

  var resetApp = function() {
    hideElement(searchElement)
    hideElement(actionsElement)
    hideElement(connections)
    hideElement(authorize)
    hideElement(start)
    showElement(status)
    showElement(signin)
    showElement(loginButtons)
  }

  var prepareSignIn = function () {
    hideElement(loginButtons)
    showElement(authorize)
  }

  var signUserIn = function (webid) {
    if (!webid && accountURI.value.length > 0) {
      webid = accountURI.value
    }

    if (webid) {
      console.log('Webid:', webid)
      var url = webid
      var req = new window.XMLHttpRequest()
      if (url.indexOf("http") < 0) {
        url = 'https://'+url
      }

      // define onload behavior
      req.onload = function (e) {
        // find login URL from Link headers
        var rels = parseLinkHeader(req.getResponseHeader('Link'))
        loginUrl = rels['http://solid.github.io/vocab/solid-terms.ttl#loginEndpoint']
        User.proxyEndpoint = rels['http://solid.github.io/vocab/solid-terms.ttl#proxyEndpoint'].href
        User.queryEndpoint = rels['http://solid.github.io/vocab/solid-terms.ttl#twinqlEndpoint'].href
        saveLocalStorage(User)
        saveLastAccount(url)
        if (loginUrl && loginUrl.href.length > 0) {
          var href = loginUrl.href+"?redirect="+encodeURIComponent(redirTo())+"&origin="+encodeURIComponent(appOrigin)
          window.location.href = href
        }
      }
      // define onerror behavior
      req.onerror = function (e) {
        var err = {
          msg: e.statusText,
          status: e.status
        }
        // deal with error
      }
      req.open('OPTIONS', url)
      req.send()
    }
  }

  var signUserUp = function () {
    SolidClient.signup().then(function (webid) {
      if (!webid || webid.length === 0) {
        console.log('Could not sign you in. Empty User header returned by server.')
        addFeedback('error', 'Could not sign you in.')
      } else {
        signUserIn(webid)
      }
    })
  }

  var signUserOut = function () {
    hideElement(welcome)
    resetApp()
    // clear connections list
    uList.clear()
    // clear local user
    clearLocalStorage()
    // push new state
    pushState()
  }

  // MISC
  function unquote (value) {
    if (value.charAt(0) == '"' && value.charAt(value.length - 1) == '"') {
        return value.substring(1, value.length - 1);
    }
    return value;
  }

  var parseLinkHeader = function (header) {
    var linkexp = /<[^>]*>\s*(\s*;\s*[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*")))*(,|$)/g
    var paramexp = /[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*"))/g

    var matches = header.match(linkexp)
    var rels = {}
    for (var i = 0; i < matches.length; i++) {
      var split = matches[i].split('>')
      var href = split[0].substring(1)
      var ps = split[1]
      var link = {}
      link.href = href
      var s = ps.match(paramexp)
      for (var j = 0; j < s.length; j++) {
        var p = s[j]
        var paramsplit = p.split('=')
        var name = paramsplit[0]
        link[name] = unquote(paramsplit[1])
      }

      if (link.rel !== undefined) {
        rels[link.rel] = link
      }
    }

    return rels;
  }

  var first = function (arr) {
    if (arr.length === 0) {
      return ''
    }
    if (arr[0].length === 0) {
      return ''
    }
    return arr[0]
  }

  var ahref = function(uri, alt, classes) {
    return `<a href="${uri}" alt="${alt}" class="${classes}" target="_blank">${uri}</a>`
  }

  var saveLocalStorage = function(data) {
    try {
      var json = JSON.stringify(data)
      window.localStorage.setItem(appUrl, json)
    } catch(err) {
      console.log(err)
    }
  }

  var loadLocalStorage = function() {
    try {
      var user = JSON.parse(window.localStorage.getItem(appUrl))
      if (user) {
        User = user
        window.User = User
        if (User.profile) {
          Connections[User.webid] = User.profile
        }
      } else {
        clearLocalStorage()
      }
    } catch(err) {
      console.log(err)
    }
  }

  var clearLocalStorage = function() {
    try {
      window.localStorage.removeItem(appUrl)
    } catch(err) {
      console.log(err)
    }
  }

  var saveLastAccount = function(acc) {
    try {
      var json = JSON.stringify({'account': acc})
      console.log('saving last used account:',appUrl+'#account')
      window.localStorage.setItem(appUrl+'#account', json)
    } catch(err) {
      console.log(err)
    }
  }
  var loadLastAccount = function () {
    try {
      var acc = JSON.parse(window.localStorage.getItem(appUrl+'#account'))
      if (acc && acc.account) {
        accountURI.value = acc.account
      }
    } catch(err) {
      console.log(err)
    }
  }

  // ------------ INIT APP ------------
  loadLocalStorage()
  loadLastAccount()

  var route = function () {
    if (queryVals['list']) {
      cancelView()
      uList.clear()
      showList(queryVals['list'])
    } else if (queryVals['view']) {
      cancelView()
      viewProfile(queryVals['view'])
    } else if (queryVals['invited']) {
      if (queryVals['key'] && queryVals['webid']) {
        User.webid = queryVals['webid']
        User.authkey = queryVals['key']
        saveLocalStorage(User)
      }
      if (!User.webid) {
        loginButtons.getElementsByTagName('h4')[0].innerHTML = "You must log in to accept the invitation."
      } else {
        connectBack(queryVals['invited'])
      }
    } else if (queryVals['key'] && queryVals['webid']) {
      User.webid = queryVals['webid']
      User.authkey = queryVals['key']
      saveLocalStorage(User)
      pushState('list', User.webid)
      showList(User.webid)
    } else if (queryVals['signout']) {
      clearLocalStorage()
      pushState()
      signUserOut()
    } else {
      if (User.webid) {
        // resetApp()
        cancelView()
        pushState('list', User.webid)
        showList(User.webid)
      } else {
        // resetApp()
        pushState()
        signUserOut()
      }
    }
  }
  route()

  // public methods
  return {
    user: User,
    addFeedback: addFeedback,
    initApp: initApp,
    twinqlQuery: twinqlQuery,
    signout: signUserOut
  }
})()

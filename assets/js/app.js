(function () {
  var $rdf = window.$rdf

  // constants
  const appContainer = 'connections'
  const appUrl = document.location.protocol + '//' + document.location.host +
                document.location.pathname

  // init static elements
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
  var cancelNewBtn = document.getElementsByClassName('cancel-new')
  var showNewModal = document.getElementsByClassName('show-new')
  var lookupElement = document.getElementById('lookup')
  var profileInfo = document.getElementById('profile-info')

  var Solid = require('solid')

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
  var items = []

  // ------------ END LIST CONF ------------

  // ------------ TYPE REGISTRY ------------
  // Discovers where connections data is stored using the type registry
  // (also triggers a registration if no locations are found)
  var registerApp = function (webid) {
    status.innerHTML = newStatus('Loading your profile...')
    return Solid.identity.getProfile(webid)
      .then(function (profile) {
        var localUser = importSolidProfile(profile)
        User.webid = profile.webId
        User.name = localUser.name
        User.inbox = localUser.inbox
        // We need to register
        if (!profile.typeIndexListed.uri) {
          console.log('No registry found')
          // Create typeIndex
          status.innerHTML = newStatus('Initializing app...')
          profile.initTypeRegistry().then(function (profile) {
            registerType(profile)
          })
        } else {
          console.log('Found registry', profile.typeIndexListed.uri)
          // Load registry and find location for data
          // TODO add ConnectionsIndex to the solid terms vocab
          status.innerHTML = newStatus('Loading app data...')
          profile.loadTypeRegistry()
            .then(function (profile) {
              var privIndexes = profile.typeRegistryForClass(Solid.vocab.solid('PrivateConnections'))
              var pubIndexes = profile.typeRegistryForClass(Solid.vocab.solid('PublicConnections'))
              if (pubIndexes.concat(privIndexes).length === 0) {
                // register
                registerType(profile)
              } else {
                User.pubIndexes = pubIndexes
                User.privIndexes = privIndexes
                loadConnections()
              }
            })
            .catch(function (err) {
              console.log('Could not load type registry:', err)
            })
        }
      })
      .catch(function (err) {
        console.log('Could not load profile:', err)
        addFeedback('error', 'Could not load profile data')
      })
  }

  // Register the app data location with the type registry
  // TODO this belongs in Solid.js
  var registerType = function (profile) {
    if (profile.storage.length > 0) {
      Solid.web.createContainer(profile.storage, appContainer, {}).then(function (meta) {
        var classToRegister = Solid.vocab.solid('PrivateConnections')
        // TODO add UI for storage selection
        var dataLocation = Solid.util.absoluteUrl(profile.storage[0], meta.url)
        var slug = 'privIndex.ttl'
        var isListed = false
        Solid.web.post(dataLocation, null, slug).then(function (response) {
          var location = Solid.util.absoluteUrl(dataLocation, response.url)
          profile.registerType(classToRegister, location, 'instance', isListed).then(function (profile) {
            var privIndexes = profile.typeRegistryForClass(Solid.vocab.solid('PrivateConnections'))
            classToRegister = Solid.vocab.solid('PublicConnections')
            // TODO add UI for storage selection
            var location = Solid.util.absoluteUrl(profile.storage[0], meta.url)
            slug = 'pubIndex.ttl'
            isListed = true
            Solid.web.post(dataLocation, null, slug).then(function (response) {
              location = Solid.util.absoluteUrl(dataLocation, response.url)
              profile.registerType(classToRegister, location, 'instance', isListed).then(function (profile) {
                var pubIndexes = profile.typeRegistryForClass(Solid.vocab.solid('PublicConnections'))
                User.webid = profile.webId
                User.pubIndexes = pubIndexes
                User.privIndexes = privIndexes
                loadConnections()
              })
              .catch(function (err) {
                console.log('Could not create public data registry:', err)
                addFeedback('error', 'Could not create public data registry')
              })
            })
            .catch(function (err) {
              console.log('Could not create public connection index:', err)
              addFeedback('error', 'Could not create public connection index')
            })
          })
          .catch(function (err) {
            console.log('Could not create private data registry:', err)
            addFeedback('error', 'Could not create private data registry')
          })
        }).catch(function (err) {
          console.log('Could not create private connection index:', err)
          addFeedback('error', 'Could not create private connection index')
        })
      })
      .catch(function (err) {
        console.log('Could not create data folder for app:', err)
        addFeedback('error', 'Could not create data folder for app')
      })
    }
  }

  // -------------- END TYPE REGISTRY --------------

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

  // -------------- ADD/REMOVE CONNECTIONS --------------
  var loadConnections = function () {
    if (!User.pubIndexes && !User.privIndexes) {
      hideElement(signin)
      console.log('No data source provided for loading connections')
      return
    }

    hideElement(signin)

    // Handle routes/states
    var referrer = queryVals['referrer']
    if (referrer && referrer.length > 0) {
      connectBack(referrer)
    }

    var indexes = User.privIndexes.concat(User.pubIndexes).map(function (index) {
      // done loading
      return Solid.web.get(index.locationUri)
        .then(function (response) {
          var g = response.parsedGraph()
          var connections = g.statementsMatching(
            undefined,
            Solid.vocab.rdf('type'),
            Solid.vocab.solid('Connection')
          )
          connections.forEach(function (person) {
            var profile = {}
            profile.webid = person.subject.uri
            profile.public = index.isListed
            profile.locationUri = index.locationUri
            profile.graph = g.statementsMatching(person.subject, undefined, undefined)
            var name = g.any(person.subject, Solid.vocab.foaf('name'))
            if (name) {
              profile.name = name.value
            }
            var picture = g.any(person.subject, Solid.vocab.foaf('img'))
            if (picture) {
              profile.picture = picture.uri
            }
            addToList(profile)
          })
          return connections.length
        })
        .catch(function () {
          // TODO handle errors in case of missing index files or no access
          return 0
        })
    })
    Promise.all(indexes).then(function (contacts) {
      var total = 0
      contacts.forEach(function (t) {
        total += t
      })
      if (total === 0) {
        showElement(start)
      }
      hideElement(status)
    })
  }

  // Add a new connection to the index document
  // @param profile {object} Contains fields contained in the index document
  // @param isPublic {bool} If true, add the connection to the public index instead
  var addConnection = function (profile, isPublic) {
    // var indexType = (isPublic) ?
    var g = $rdf.graph()
    var webid = $rdf.sym(profile.webid)
    g.add(
      webid,
      Solid.vocab.rdf('type'),
      Solid.vocab.solid('Connection')
    )
    if (profile.name) {
      g.add(
        webid,
        Solid.vocab.foaf('name'),
        $rdf.lit(profile.name)
      )
    }
    if (profile.picture) {
      g.add(
        webid,
        Solid.vocab.foaf('img'),
        $rdf.sym(profile.picture)
      )
    }
    var toAdd = []
    var toDel = null
    profile.graph = g.statementsMatching(webid, undefined, undefined)
    profile.graph.forEach(function (st) {
      toAdd.push(st.toNT())
    })
    if (User.pubIndexes.length === 0 && User.privIndexes) {
      console.log('Error saving new contact. Could not find an index document to store the new connection.')
      addFeedback('error', 'Error saving new contact')
      return
    }
    var defaultIndex
    if (User.privIndexes.length > 0 && User.privIndexes[0].locationUri) {
      defaultIndex = User.privIndexes[0].locationUri
    }
    if (isPublic &&
      User.pubIndexes.length > 0 && User.pubIndexes[0].locationUri) {
      defaultIndex = User.pubIndexes[0].locationUri
    }
    profile.locationUri = defaultIndex
    Solid.web.patch(defaultIndex, toDel, toAdd)
      .then(function () {
        // Update the profile object with the new registry without reloading
        addToList(profile, 'name', 'asc', true)
        // send a notification to the user's inbox
        var link = appUrl + '?referrer=' + encodeURIComponent(User.webid)
        var title = 'New connection'
        var content = User.name + ' has just connected with you!' +
                      ' Click here to connect with this person -- ' + link
        sendNotification(profile.inbox, title, content)
      })
      .catch(function (err) {
        console.log('Error saving new contact:' + err)
        addFeedback('error', 'Error saving new contact')
      })
  }

  // Add the new connection to the list and sort the list
  // @param profile {object} Contains fields contained in the index document
  // @param sort {string} Value to use for sorting (name, email, etc.)
  // @param order {string} Value to use for ordering (asc / desc)
  // @param verbose {bool} If true, show feedback to the user
  var addToList = function (profile, sort, order, verbose) {
    sort = sort || 'name'
    order = order || 'asc'

    showElement(lookupElement)
    showElement(infoButtons)
    if (uList.get('webid', profile.webid).length > 0 && verbose) {
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
      item.email = profile.email
    }
    item.status = profile.status || 'invitation sent'
    // Add to list of connections
    Connections[profile.webid] = profile
    // Add to UI
    uList.add(item)
    hideElement(welcome)
    showElement(searchElement)
    showElement(actionsElement)
    // clear the info profile
    profileInfo.innerHTML = ''
    if (verbose) {
      addFeedback('success', 'You have a new connection!')
    }
    uList.sort(sort, { order: order })
  }

  // Remove a connection
  var removeConnection = function (webid) {
    var toAdd = null
    var toDel = []

    var profile = Connections[webid]
    profile.graph.forEach(function (st) {
      toDel.push(st.toNT())
    })
    Solid.web.patch(profile.locationUri, toDel, toAdd).then(function () {
      var moverlay = document.getElementById('delete-dialog')
      if (moverlay) {
        moverlay.getElementsByClassName('modal-header')[0].innerHTML = ''
        moverlay.getElementsByClassName('modal-footer')[0].innerHTML = ''
        moverlay.getElementsByClassName('modal-body')[0].innerHTML = `<div class="icon-success svg text-center">
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
      }

      // Remove the connection from the local list
      delete Connections[webid]
      // Remove the UI element
      uList.remove('webid', webid)
      cancelView()
    })
    .catch(function (err) {
      console.log(err)
      addFeedback('error', 'Could not remove connection from server')
    })
  }

  // Handle connect back case
  var connectBack = function (webid) {
    document.getElementById('webid').value = webid
    // clear the contents of the modal
    hideElement(lookupElement)
    hideElement(infoButtons)
    showModal()
    findWebID()
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
    if (!data.parsedGraph) {
      return null
    }

    var g = data.parsedGraph

    var profile = {}

    // set webid
    profile.webid = data.webId

    var webidRes = $rdf.sym(data.webId)

    // set name
    var name = g.any(webidRes, Solid.vocab.foaf('name'))
    if (name && name.value.length > 0) {
      profile.name = name.value
    } else {
      profile.name = ''
      // use familyName and givenName instead of full name
      var givenName = g.any(webidRes, Solid.vocab.foaf('givenName'))
      if (givenName) {
        profile.name += givenName.value
      }
      var familyName = g.any(webidRes, Solid.vocab.foaf('familyName'))
      if (familyName) {
        profile.name += (givenName) ? ' ' + familyName.value : familyName.value
      }
      // use nick
      if (!givenName && !familyName) {
        var nick = g.any(webidRes, Solid.vocab.foaf('nick'))
        if (nick) {
          profile.name = nick.value
        }
      }
    }

    // set picture
    var img = g.any(webidRes, Solid.vocab.foaf('img'))
    var pic
    if (img) {
      pic = img
    } else {
      // check if profile uses depic instead
      var depic = g.any(webidRes, Solid.vocab.foaf('depiction'))
      if (depic) {
        pic = depic
      }
    }
    if (pic && pic.uri.length > 0) {
      profile.picture = pic.uri
    }

    var emails = g.statementsMatching(webidRes, Solid.vocab.foaf('mbox'))
    if (emails.length > 0) {
      profile.emails = []
      emails.forEach(function (email) {
        var addr = email.object.uri
        if (addr && addr.length > 0) {
          if (addr.indexOf('mailto:') === 0) {
            addr = addr.slice(7)
          }
          if (profile.emails.indexOf(addr) < 0) {
            profile.emails.push(addr)
          }
        }
      })
    }

    var phones = g.statementsMatching(webidRes, Solid.vocab.foaf('phone'))
    if (phones.length > 0) {
      profile.phones = []
      phones.forEach(function (phone) {
        var tel = phone.object.uri
        if (tel && tel.length > 0) {
          if (tel.indexOf('tel:') === 0) {
            tel = tel.slice(4)
          }
          if (profile.phones.indexOf(tel) < 0) {
            profile.phones.push(tel)
          }
        }
      })
    }

    var homepages = g.statementsMatching(webidRes, Solid.vocab.foaf('homepage'))
    if (homepages.length > 0) {
      profile.homepages = []
      homepages.forEach(function (homepage) {
        var url = homepage.object.uri
        if (profile.homepages.indexOf(url) < 0) {
          profile.homepages.push(url)
        }
      })
    }

    var inbox = g.any(webidRes, Solid.vocab.solid('inbox'))
    if (inbox) {
      profile.inbox = inbox.uri
    }

    return profile
  }

  var viewProfile = function (webid) {
    user.classList.remove('slide-out')
    user.classList.add('slide-in')
    hideElement(actionsElement)

    extendedInfo.innerHTML = newStatus('Loading profile data...')

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
    if (uList.visibleItems.length === 0) {
      hideElement(searchElement)
      hideElement(actionsElement)
      showElement(welcome)
    } else {
      showElement(actionsElement)
    }
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

    // WebID
    var section = document.createElement('div')
    var label = document.createElement('h6')
    var icon = document.createElement('i')
    icon.classList.add('fa', 'fa-user')
    label.appendChild(icon)
    label.innerHTML += ' WebID'
    section.appendChild(label)
    body.appendChild(section)

    var div = document.createElement('div')
    div.classList.add('card-meta')
    div.innerHTML = profile.webid
    body.appendChild(div)

    // Emails
    section = document.createElement('div')
    label = document.createElement('h6')
    icon = document.createElement('i')
    icon.classList.add('fa', 'fa-envelope-o')
    label.appendChild(icon)
    label.innerHTML += ' Emails'
    section.appendChild(label)
    body.appendChild(section)

    if (profile.emails && profile.emails.length > 0) {
      profile.emails.forEach(function (addr) {
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

    // Phones
    section = document.createElement('div')
    label = document.createElement('h6')
    icon = document.createElement('i')
    icon.classList.add('fa', 'fa-phone')
    label.appendChild(icon)
    label.innerHTML += ' Phones'
    section.appendChild(label)
    body.appendChild(section)

    if (profile.phones && profile.phones.length > 0) {
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

    // Homepages
    section = document.createElement('div')
    label = document.createElement('h6')
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
        div.innerHTML = page
        body.appendChild(div)
      })
    } else {
      div = document.createElement('div')
      div.classList.add('card-meta', 'grey')
      div.innerHTML = 'No homepage addresses found.'
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
    //   addToList(profile)
    //   deleteElement(card)
    //   closeModal()
    // }, false)

    // remove button
    var remove = document.getElementById('remove')
    remove.innerHTML = ''
    var removeBtn = document.createElement('button')
    remove.appendChild(removeBtn)
    removeBtn.classList.add('btn', 'btn-link')
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
      if (profile.emails[0] && profile.emails[0].length > 0) {
        email.innerHTML = profile.emails[0]
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

  // ------------ NOTIFICATIONS ------------
  var sendNotification = function (inbox, title, content) {
    var g = $rdf.graph()
    var date = new Date().toISOString()
    g.add($rdf.sym(''), Solid.vocab.rdf('type'), Solid.vocab.solid('Notification'))
    g.add($rdf.sym(''), Solid.vocab.dct('title'), $rdf.lit(title))
    g.add($rdf.sym(''), Solid.vocab.dct('created'), $rdf.lit(date, '', $rdf.NamedNode.prototype.XSDdateTime))
    g.add($rdf.sym(''), Solid.vocab.sioc('content'), $rdf.lit(content))
    g.add($rdf.sym(''), Solid.vocab.sioc('has_creator'), $rdf.sym('#author'))

    g.add($rdf.sym('#author'), Solid.vocab.rdf('type'), Solid.vocab.sioc('UserAccount'))
    g.add($rdf.sym('#author'), Solid.vocab.sioc('account_of'), $rdf.sym(User.webid))
    if (User.name) {
      g.add($rdf.sym('#author'), Solid.vocab.foaf('name'), $rdf.lit(User.name))
    }
    if (User.picture) {
      g.add($rdf.sym('#author'), Solid.vocab.sioc('avatar'), $rdf.sym(User.picture))
    }

    var data = new $rdf.Serializer(g).toN3(g)
    Solid.web.post(inbox, data)
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
      removeConnection(profile.webid)
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

  // ------------ EVENT LISTENERS ------------

  // sign in/up button
  signinBtn.addEventListener('click', function () {
    signUserIn()
  }, false)

  signupBtn.addEventListener('click', function () {
    signUserUp()
  }, false)

  signoutBtn.addEventListener('click', function () {
    signUserOut()
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

  // INIT APP
  var initApp = function (webid) {
    hideElement(signin)
    showElement(welcome)
    showElement(connections)

    // register App
    registerApp(webid)
    if (uList.visibleItems.length === 0) {
      showElement(welcome)
    } else {
      showElement(searchElement)
      showElement(actionsElement)
      uList.sort('name', { order: 'asc' })
    }
  }

  var signUserIn = function () {
    Solid.login().then(function (webid) {
      if (!webid || webid.length === 0) {
        console.log('Could not sign you in. Empty User header returned by server.')
        addFeedback('error', 'Could not sign you in.')
      } else {
        initApp(webid)
      }
    })
  }

  var signUserUp = function () {
    Solid.login().then(function (webid) {
      if (!webid || webid.length === 0) {
        console.log('Could not sign you in. Empty User header returned by server.')
        addFeedback('error', 'Could not sign you in.')
      } else {
        initApp(webid)
      }
    })
  }

  var signUserOut = function () {
    hideElement(searchElement)
    hideElement(actionsElement)
    hideElement(connections)
    showElement(status)
    showElement(signin)

    // clear connections list
    uList.clear()
  }

  // public methods
  // return {
  //   user: User,
  //   addFeedback: addFeedback,
  //   registerApp: registerApp
  // }
})()

import { httpRouter } from 'convex/server'

import { authComponent, createAuth } from './auth'
import { receiveHttp } from './inbox'

const http = httpRouter()

authComponent.registerRoutes(http, createAuth)

// Forwarded emails for the inbox (see inbox.ts).
http.route({ path: '/inbound-email', method: 'POST', handler: receiveHttp })

export default http

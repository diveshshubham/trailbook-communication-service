# Public Album API Documentation

## Overview

A comprehensive public album system where users can create collaborative albums, invite others (even if they don't exist on the platform yet), and manage contributors with different permission levels.

## Unique Features

1. **Invite by Email/Phone**: Invite users who don't exist on the platform yet
2. **Auto-Accept on Signup**: Invitations are automatically accepted when user signs up with matching email/phone
3. **Auto-Connection**: Automatically create connection requests when invitations are accepted
4. **Permission System**: Three levels - Contributor, Viewer, Admin
5. **Activity Feed**: Track all activities in the album (who added what, when)
6. **Analytics**: Get insights on album activity and top contributors
7. **Scalable Design**: Optimized indexes and efficient queries

---

## Schemas

### Album Invitation Schema
- `albumId`: Reference to the album
- `inviterId`: User who sent the invitation
- `inviteeUserId`: User ID (if user exists)
- `inviteeEmail`: Email (if user doesn't exist yet)
- `inviteePhone`: Phone (if user doesn't exist yet)
- `status`: pending, accepted, rejected
- `permission`: contributor, viewer, admin
- `autoConnect`: Auto-create connection when accepted

### Album Activity Schema
- Tracks all activities: media added, contributors added/removed, invitations, etc.
- Indexed for efficient queries

### Updated Album Schema
- `contributorIds`: Array of user IDs who can contribute
- `createdBy`: Original creator
- `allowContributors`: Whether album accepts contributors
- `contributorCount`: Number of active contributors

---

## API Endpoints

### 1. Create Public Album
```bash
POST /api/public-albums/create
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "My Public Album",
  "description": "Album description",
  "allowContributors": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Public album created",
  "data": {
    "albumId": "album_id",
    "message": "Public album created successfully"
  }
}
```

---

### 2. Invite User to Album
```bash
POST /api/public-albums/invite
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "albumId": "album_id",
  "userId": "user_id",        // If user exists
  "email": "user@example.com", // If user doesn't exist
  "phone": "+1234567890",      // If user doesn't exist
  "permission": "contributor",  // contributor, viewer, admin
  "autoConnect": true           // Auto-connect when accepted
}
```

**Note:** Provide at least one of: `userId`, `email`, or `phone`

**Response:**
```json
{
  "success": true,
  "message": "User invited successfully",
  "data": {
    "invitationId": "invitation_id",
    "message": "Invitation sent successfully"
  }
}
```

---

### 3. Accept Invitation
```bash
PUT /api/public-albums/invitations/:invitationId/accept
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Invitation accepted",
  "data": {
    "invitationId": "invitation_id",
    "message": "Invitation accepted successfully"
  }
}
```

---

### 4. Reject Invitation
```bash
PUT /api/public-albums/invitations/:invitationId/reject
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Invitation rejected",
  "data": {
    "invitationId": "invitation_id",
    "message": "Invitation rejected"
  }
}
```

---

### 5. Get My Invitations
```bash
GET /api/public-albums/invitations/my
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Invitations fetched",
  "data": {
    "invitations": [
      {
        "_id": "invitation_id",
        "album": {
          "_id": "album_id",
          "title": "Album Title",
          "coverImage": "cover_image_key"
        },
        "inviter": {
          "_id": "user_id",
          "email": "inviter@example.com"
        },
        "status": "pending",
        "permission": "contributor",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### 6. Get Album Contributors
```bash
GET /api/public-albums/:albumId/contributors
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Contributors fetched",
  "data": {
    "contributors": [
      {
        "userId": "user_id",
        "fullName": "User Name",
        "bio": "User bio",
        "profilePicture": "profile_picture_key",
        "location": "Location"
      }
    ]
  }
}
```

---

### 7. Remove Contributor
```bash
DELETE /api/public-albums/:albumId/contributors/:contributorId
Authorization: Bearer YOUR_JWT_TOKEN
```

**Note:** Only creator or admins can remove contributors

**Response:**
```json
{
  "success": true,
  "message": "Contributor removed",
  "data": {
    "message": "Contributor removed successfully"
  }
}
```

---

### 8. Get Album Activity Feed
```bash
GET /api/public-albums/:albumId/activity
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Activity feed fetched",
  "data": {
    "activities": [
      {
        "_id": "activity_id",
        "activityType": "media_added",
        "user": {
          "_id": "user_id",
          "email": "user@example.com"
        },
        "media": {
          "_id": "media_id",
          "key": "media_key",
          "title": "Media Title"
        },
        "description": "Added media to album",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Activity Types:**
- `media_added`: Media was added to album
- `contributor_added`: User joined as contributor
- `contributor_removed`: Contributor was removed
- `album_updated`: Album details updated
- `invitation_sent`: Invitation was sent
- `invitation_accepted`: Invitation was accepted

---

### 9. Get Album Analytics
```bash
GET /api/public-albums/:albumId/analytics
Authorization: Bearer YOUR_JWT_TOKEN
```

**Note:** Only creator or admins can view analytics

**Response:**
```json
{
  "success": true,
  "message": "Analytics fetched",
  "data": {
    "albumId": "album_id",
    "contributorCount": 5,
    "photoCount": 120,
    "activityStats": {
      "media_added": 120,
      "contributor_added": 5,
      "invitation_sent": 8
    },
    "topContributors": 5
  }
}
```

---

## Permission Levels

1. **CONTRIBUTOR**: Can add media to the album
2. **VIEWER**: Can only view the album (read-only)
3. **ADMIN**: Can manage album, invite users, and remove contributors

---

## Auto-Accept Feature

When a user signs up with an email or phone that matches a pending invitation, the invitation is automatically accepted. Call this method after user registration:

```typescript
// In your auth service after user registration
await publicAlbumService.autoAcceptInvitationsForNewUser(
  userId,
  email,
  phone
);
```

---

## Media Upload Permission Check

The media service has been updated to check if a user is a contributor to a public album. Users can now upload media if:
- They own the album, OR
- They are a contributor to a public album

---

## Workflow Example

1. **User A creates a public album**
   ```bash
   POST /api/public-albums/create
   ```

2. **User A invites User B (who doesn't exist yet)**
   ```bash
   POST /api/public-albums/invite
   {
     "albumId": "album_id",
     "email": "userb@example.com",
     "permission": "contributor",
     "autoConnect": true
   }
   ```

3. **User B signs up with that email**
   - Invitation is automatically accepted
   - User B becomes a contributor
   - Connection request is automatically sent to User A

4. **User B uploads media to the album**
   ```bash
   POST /api/media/upload
   {
     "albumId": "album_id",
     ...
   }
   ```

5. **View activity feed**
   ```bash
   GET /api/public-albums/:albumId/activity
   ```

---

## Database Indexes

All schemas are optimized with proper indexes:
- Album invitations: Indexed on albumId, status, invitee identifiers
- Album activities: Indexed on albumId, userId, activityType, createdAt
- Albums: Indexed on userId, isPublic, contributorIds

---

## Error Handling

All endpoints return proper error responses:
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found

---

## Notes

- Only album creator or admins can invite users
- Only album creator or admins can remove contributors
- Creator cannot be removed from album
- Auto-connect feature creates connection requests automatically
- Activity feed tracks all important events
- Analytics provide insights on album engagement

---

## Integration with Existing Services

- **Media Service**: Updated to check contributor permissions
- **Connection Service**: Auto-creates connections when invitations accepted
- **User Service**: Can call `autoAcceptInvitationsForNewUser` after registration

---

## Future Enhancements (Ideas)

1. **Notification System**: Send notifications for invitations and activities
2. **Album Templates**: Pre-configured album types
3. **Collaboration Features**: Comments, reactions on album level
4. **Export/Download**: Bulk download album media
5. **Album Sharing**: Share album via link with access control
6. **Contributor Roles**: More granular permissions
7. **Album Versioning**: Track changes and revisions
8. **Smart Invitations**: Suggest users to invite based on connections

---

## Frontend UI/UX Design Prompt for AI Agent

### Overview
Create a premium, cutting-edge UI/UX for the Public Album feature that surpasses Instagram, Pinterest, and other social media platforms. Focus on intuitive collaboration, beautiful visual design, and seamless user experience.

### Design Principles

1. **Visual Hierarchy**: Clear, intuitive navigation with visual cues
2. **Collaboration-First**: Make inviting and managing contributors feel natural
3. **Real-Time Feedback**: Show live updates, typing indicators, and activity
4. **Accessibility**: WCAG 2.1 AA compliant, keyboard navigation, screen reader support
5. **Performance**: Smooth animations, lazy loading, optimized rendering
6. **Mobile-First**: Responsive design that works beautifully on all devices

---

### Key UI Components & Features

#### 1. Album Creation Flow
**Design Requirements:**
- **Wizard-style creation** with 3-4 steps:
  - Step 1: Album title, description, cover image selection
  - Step 2: Privacy settings (public/private, allow contributors toggle)
  - Step 3: Invite initial contributors (optional)
  - Step 4: Preview and confirm
- **Visual Elements:**
  - Large, beautiful cover image picker with drag-and-drop
  - Real-time preview of album card
  - Smooth transitions between steps
  - Progress indicator (e.g., "Step 2 of 4")
  - "Skip for now" option on invitation step

**UX Enhancements:**
- Auto-save draft as user types
- Suggested album titles based on location/date
- Template gallery for quick start (Travel, Event, Family, etc.)
- Smart suggestions for who to invite based on connections

---

#### 2. Album Gallery View
**Design Requirements:**
- **Masonry/Pinterest-style grid** with:
  - Variable height images maintaining aspect ratio
  - Hover effects showing contributor badges
  - Quick action buttons on hover (view, share, settings)
  - Infinite scroll with smooth loading
  - Filter/sort options (newest, oldest, most contributed, by contributor)
- **Visual Elements:**
  - Contributor avatars in corner of each album card
  - Activity indicator (pulse animation for recent activity)
  - Badge showing "New" for albums with unviewed content
  - Beautiful empty states with illustrations

**UX Enhancements:**
- **Quick Actions Menu**: Long-press or right-click for context menu
- **Bulk Selection**: Multi-select albums for batch operations
- **Smart Grouping**: Group albums by event, location, or date
- **Search & Filters**: Advanced search with tags, contributors, date range
- **View Modes**: Grid, List, Timeline, Map view (if location data available)

---

#### 3. Album Detail Page
**Design Requirements:**
- **Hero Section:**
  - Large, immersive cover image (full-width, parallax effect)
  - Album title and description overlay
  - Contributor avatars in a row (with "+X more" indicator)
  - Quick stats (photos, contributors, views)
  - Action buttons: Invite, Share, Settings, Edit
- **Media Grid:**
  - Lightbox-style gallery with smooth transitions
  - Contributor tags on each photo
  - Upload progress indicators
  - Drag-and-drop reordering (for album owner/admin)
- **Sidebar/Info Panel:**
  - Contributors list with roles
  - Activity feed (compact, expandable)
  - Album analytics (for owner/admin)
  - Settings and permissions

**UX Enhancements:**
- **Keyboard Navigation**: Arrow keys to navigate photos, ESC to close
- **Swipe Gestures**: Swipe left/right on mobile, pinch to zoom
- **Live Updates**: Real-time notifications when new photos are added
- **Smart Loading**: Progressive image loading with blur-up effect
- **Contextual Actions**: Different actions based on user role (owner/contributor/viewer)

---

#### 4. Invitation System
**Design Requirements:**
- **Invite Modal/Drawer:**
  - Beautiful, multi-step invitation flow
  - Tabbed interface: "Invite by Username", "Invite by Email/Phone", "Invite from Contacts"
  - Real-time search/autocomplete for existing users
  - Permission selector (Contributor, Viewer, Admin) with clear descriptions
  - Toggle for "Auto-connect" with explanation
  - Preview of invitation message
- **Invitation List:**
  - Card-based design showing:
    - Inviter avatar and name
    - Album cover and title
    - Permission level badge
    - Status (pending/accepted/rejected)
    - Time remaining (for pending)
  - Quick actions: Accept, Reject, View Album
  - Filter by status
  - Empty state with illustration

**UX Enhancements:**
- **Bulk Invite**: Select multiple users at once
- **Invitation Templates**: Pre-written messages for different scenarios
- **Smart Suggestions**: AI-powered suggestions for who to invite
- **Invitation Analytics**: Track acceptance rates
- **Reminder System**: Gentle reminders for pending invitations

---

#### 5. Contributor Management
**Design Requirements:**
- **Contributors Grid:**
  - Avatar cards with:
    - Profile picture
    - Name and role badge
    - Contribution count
    - Last active time
    - Quick actions menu
  - Role indicators with color coding:
    - Admin: Gold badge
    - Contributor: Blue badge
    - Viewer: Gray badge
- **Permission Management:**
  - Drag-and-drop role assignment
  - Bulk permission changes
  - Clear visual hierarchy showing who can do what
  - Confirmation dialogs for destructive actions

**UX Enhancements:**
- **Activity Timeline**: See each contributor's activity
- **Contribution Stats**: Visual charts showing contribution distribution
- **Role Suggestions**: Suggest promoting active contributors to admin
- **Remove Contributor Flow**: Smooth removal with option to notify

---

#### 6. Activity Feed
**Design Requirements:**
- **Timeline Design:**
  - Vertical timeline with activity cards
  - User avatars with activity icons
  - Rich media previews for media_added activities
  - Collapsible groups for similar activities
  - Real-time updates with smooth animations
- **Activity Types Visualization:**
  - Media added: Photo thumbnail with overlay
  - Contributor added: User card with welcome message
  - Invitation sent: Invitation card preview
  - Album updated: Before/after comparison

**UX Enhancements:**
- **Filter Activities**: By type, user, date range
- **Activity Insights**: "Most active contributor", "Peak activity times"
- **Export Activity**: Download activity log as PDF/CSV
- **Notifications**: In-app notifications for important activities

---

#### 7. Analytics Dashboard
**Design Requirements:**
- **Dashboard Layout:**
  - Overview cards with key metrics (total photos, contributors, views)
  - Interactive charts (line, bar, pie charts)
  - Time range selector (7 days, 30 days, all time)
  - Export options
- **Visual Elements:**
  - Color-coded charts
  - Animated transitions
  - Responsive charts that work on mobile
  - Comparison views (this month vs last month)

**UX Enhancements:**
- **Insights Panel**: AI-generated insights ("Your album grew 20% this week")
- **Top Contributors**: Visual leaderboard
- **Activity Heatmap**: Calendar view showing activity intensity
- **Growth Metrics**: Track album growth over time

---

### Advanced UI/UX Features

#### 1. Real-Time Collaboration
- **Live Indicators:**
  - "User X is viewing this album" badge
  - "User Y is uploading..." progress indicator
  - Typing indicators in comments/chat
  - Cursor positions (if implementing collaborative editing)
- **Notifications:**
  - Toast notifications for new activities
  - In-app notification center
  - Browser push notifications (with permission)

#### 2. Smart Features
- **AI-Powered Suggestions:**
  - Suggest who to invite based on connections
  - Auto-tag photos with location/people
  - Suggest album titles based on content
  - Smart photo organization
- **Contextual Help:**
  - Tooltips explaining features
  - Interactive onboarding tour
  - Contextual help buttons
  - Video tutorials embedded

#### 3. Accessibility Features
- **Keyboard Navigation:**
  - Full keyboard support for all actions
  - Focus indicators
  - Skip links
  - Keyboard shortcuts (documented)
- **Screen Reader Support:**
  - ARIA labels
  - Semantic HTML
  - Alt text for all images
  - Descriptive link text
- **Visual Accessibility:**
  - High contrast mode
  - Font size adjustment
  - Colorblind-friendly color schemes
  - Reduced motion option

#### 4. Performance Optimizations
- **Loading States:**
  - Skeleton screens instead of spinners
  - Progressive image loading
  - Lazy loading for below-fold content
  - Optimistic UI updates
- **Animations:**
  - Smooth, performant animations (60fps)
  - Reduced motion respect
  - Micro-interactions for feedback
  - Page transitions

#### 5. Mobile Experience
- **Mobile-Specific Features:**
  - Bottom sheet modals
  - Swipe gestures for navigation
  - Pull-to-refresh
  - Haptic feedback
  - Camera integration for quick uploads
- **Responsive Design:**
  - Breakpoints: Mobile (320px+), Tablet (768px+), Desktop (1024px+)
  - Touch-friendly targets (min 44x44px)
  - Adaptive layouts
  - Mobile-first approach

---

### Color Palette & Design System

#### Primary Colors
- **Brand Primary**: Modern, vibrant color (e.g., #6366F1 - Indigo)
- **Success**: Green (#10B981)
- **Warning**: Amber (#F59E0B)
- **Error**: Red (#EF4444)
- **Info**: Blue (#3B82F6)

#### Neutral Colors
- **Background**: Light mode (#FFFFFF), Dark mode (#0F172A)
- **Surface**: Light mode (#F8FAFC), Dark mode (#1E293B)
- **Text Primary**: Light mode (#0F172A), Dark mode (#F1F5F9)
- **Text Secondary**: Light mode (#64748B), Dark mode (#94A3B8)

#### Typography
- **Font Family**: Modern sans-serif (Inter, Poppins, or system font stack)
- **Headings**: Bold, clear hierarchy (H1: 32px, H2: 24px, H3: 20px)
- **Body**: 16px base, 1.5 line height
- **Small Text**: 14px for captions, labels

#### Spacing System
- **Base Unit**: 4px
- **Spacing Scale**: 4, 8, 12, 16, 24, 32, 48, 64, 96px
- **Consistent margins and padding**

#### Shadows & Elevation
- **Subtle shadows** for depth
- **Elevation levels**: 0 (flat), 1 (hover), 2 (active), 3 (modal)
- **Smooth transitions** between states

---

### Animation Guidelines

1. **Micro-interactions:**
   - Button hover: Scale 1.02, shadow increase
   - Card hover: Lift effect with shadow
   - Icon animations: Smooth rotation/scale
   - Loading states: Skeleton shimmer

2. **Page Transitions:**
   - Fade in/out for page changes
   - Slide animations for modals
   - Smooth scroll behavior
   - Parallax effects (sparingly)

3. **Feedback Animations:**
   - Success: Checkmark animation
   - Error: Shake animation
   - Loading: Skeleton or spinner
   - Confirmation: Confetti (optional, for celebrations)

---

### Component Library Recommendations

#### UI Framework Options:
1. **React**: Material-UI, Chakra UI, or custom with Tailwind CSS
2. **Vue**: Vuetify, Quasar, or custom with Tailwind CSS
3. **Angular**: Angular Material or custom with Tailwind CSS

#### Key Components Needed:
- **Image Gallery**: React Image Gallery, Swiper, or custom
- **Lightbox**: Yet Another React Lightbox, PhotoSwipe
- **Charts**: Recharts, Chart.js, or D3.js
- **Date Picker**: React DatePicker, Flatpickr
- **Drag & Drop**: React DnD, @dnd-kit
- **Infinite Scroll**: React Infinite Scroll, Intersection Observer API

---

### Implementation Checklist

#### Phase 1: Core Features
- [ ] Album creation flow
- [ ] Album gallery view
- [ ] Album detail page
- [ ] Basic invitation system
- [ ] Contributor list

#### Phase 2: Advanced Features
- [ ] Activity feed
- [ ] Analytics dashboard
- [ ] Real-time updates
- [ ] Advanced filtering/search
- [ ] Mobile optimization

#### Phase 3: Polish
- [ ] Animations and transitions
- [ ] Accessibility improvements
- [ ] Performance optimization
- [ ] Error handling and edge cases
- [ ] User testing and refinement

---

### Testing Requirements

1. **Cross-Browser Testing**: Chrome, Firefox, Safari, Edge
2. **Device Testing**: iOS, Android, Desktop (various screen sizes)
3. **Accessibility Testing**: Screen readers, keyboard navigation
4. **Performance Testing**: Lighthouse scores (90+), Core Web Vitals
5. **User Testing**: A/B testing, usability studies

---

### Success Metrics

- **User Engagement**: Time spent, interactions per session
- **Collaboration Rate**: % of albums with multiple contributors
- **Invitation Acceptance**: % of invitations accepted
- **Performance**: Page load time < 2s, Time to Interactive < 3s
- **Accessibility**: WCAG 2.1 AA compliance
- **User Satisfaction**: NPS score, user feedback

---

### Inspiration & References

**Study these platforms for inspiration:**
- **Instagram**: Photo grid, stories, reels
- **Pinterest**: Masonry layout, collections
- **Google Photos**: Smart organization, sharing
- **Notion**: Collaboration features, permissions
- **Figma**: Real-time collaboration indicators
- **Linear**: Beautiful, minimal design
- **Vercel**: Smooth animations, modern aesthetics

**Key Differentiators:**
- Better collaboration UX than Instagram
- More intuitive than Pinterest
- More visual than Notion
- More social than Google Photos

---

### Final Notes

This UI should feel **premium, modern, and intuitive**. Every interaction should be delightful. The collaboration features should feel natural and seamless. The design should be accessible to everyone while maintaining a beautiful, cutting-edge aesthetic.

**Remember**: The best UI is invisible - users should focus on their content and collaboration, not the interface. Make it feel effortless and magical.

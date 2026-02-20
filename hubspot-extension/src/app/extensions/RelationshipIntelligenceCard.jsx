import { useState } from 'react';
import {
  Button,
  Text,
  Flex,
  LoadingSpinner,
  Alert,
  hubspot,
} from '@hubspot/ui-extensions';

// IMPORTANT: Replace this with your actual deployed app URL
const APP_URL = '{{APP_URL}}';

hubspot.extend(({ context, actions }) => (
  <RelationshipIntelligenceCard
    context={context}
    openIframe={actions.openIframeModal}
    fetchCrmObjectProperties={actions.fetchCrmObjectProperties}
  />
));

const RelationshipIntelligenceCard = ({
  context,
  openIframe,
  fetchCrmObjectProperties,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleOpenChat = async () => {
    setLoading(true);
    setError(null);

    try {
      const portalId = String(context.portal.id);
      const userEmail = context.user.email;
      const objectId = String(context.crm.objectId);
      const objectType = context.crm.objectTypeName || 'contacts';

      // Request a short-lived embed token from our backend
      const response = await hubspot.fetch(`${APP_URL}/api/hubspot/embed-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalId,
          userEmail,
          objectId,
          objectType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to authenticate');
      }

      const { embedUrl } = await response.json();

      // Open the chat in an iframe modal
      openIframe({
        uri: embedUrl,
        height: 700,
        width: 800,
        title: 'Relationship Intelligence',
        flush: true,
      });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex direction="column" gap="md">
      <Text variant="microcopy">
        Ask questions about this record, related contacts, meeting notes, deal
        history, and more — powered by AI with full CRM access.
      </Text>

      {error && (
        <Alert title="Connection Error" variant="error">
          {error}
        </Alert>
      )}

      {loading ? (
        <Flex justify="center">
          <LoadingSpinner label="Connecting..." />
        </Flex>
      ) : (
        <Button variant="primary" onClick={handleOpenChat}>
          Open Chat
        </Button>
      )}
    </Flex>
  );
};

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY } from '../../constants';

const PrivacyPolicyScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.meta}>Effective Date: January 19, 2026</Text>
          <Text style={styles.meta}>Last Updated: January 19, 2026</Text>
        </View>

        <Text style={styles.heading}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          This Privacy Policy ("Policy") applies to the Miri mobile application and any related platforms, software,
          and services (collectively, the "Services") provided and controlled by Foshan Xinghang Trading Co., Ltd.
          ("we," "us," or "our").
        </Text>
        <Text style={styles.paragraph}>
          We are committed to protecting your privacy and ensuring the security of your personal data. This Policy
          explains how we collect, use, share, and otherwise process the personal data of our users ("you"), as well as
          your rights regarding such data.
        </Text>
        <Text style={styles.paragraph}>
          Global Data Processing Notification: Please be aware that while our operational headquarters are located in
          China, we process and store your core personal data (specifically User Content and Biometric Data) on secure
          servers located in Singapore and other jurisdictions outside of Mainland China. We utilize world-class cloud
          infrastructure to ensure your data is treated securely and in accordance with this Policy.
        </Text>

        <Text style={styles.heading}>2. What Information We Collect</Text>
        <Text style={styles.paragraph}>
          We collect information in three ways: Information You Provide, Automatically Collected Information, and
          Information From Other Sources.
        </Text>

        <Text style={styles.subheading}>2.1 Information You Provide</Text>
        <Text style={styles.paragraph}>
          User Content: When you interact with our image editing features, we process the content you upload, generate,
          or view, such as photographs, images, and the text prompts you input ("User Content"). Crucially, this includes
          facial images which are processed to provide our retouching and aesthetic visualization features.
        </Text>
        <Text style={styles.paragraph}>
          Communications Data: When you contact us for support, feedback, or inquiries, we collect the information
          included in your communications.
        </Text>
        <Text style={styles.paragraph}>
          Account Data (Optional): If you choose to register an account (where applicable), we may collect your username,
          email address, or social media login credentials.
        </Text>

        <Text style={styles.subheading}>2.2 Automatically Collected Information</Text>
        <Text style={styles.paragraph}>
          Technical Data: We automatically collect information about the device you use to access the Services, such as
          your device model, operating system version, system language, unique device identifiers (e.g., IDFA, Android
          ID), and IP address.
        </Text>
        <Text style={styles.paragraph}>
          Usage Data: We collect information about how you use the Services, such as the features you use, the filters or
          effects you apply, the time and duration of your sessions, and crash logs.
        </Text>

        <Text style={styles.subheading}>2.3 Information From Other Sources</Text>
        <Text style={styles.paragraph}>
          Third-Party Platforms: If you choose to log in using a third-party account (e.g., Apple, Google), we may receive
          information from that service, such as your profile information, subject to your privacy settings on that
          service.
        </Text>

        <Text style={styles.heading}>3. How We Use Your Information</Text>
        <Text style={styles.paragraph}>We use your personal data for the following specific purposes:</Text>
        <Text style={styles.list}>
          - Providing and Operating the Services: To process your User Content and apply the image editing, retouching,
          and AI generation effects you request.{'\n'}
          - Biometric Processing: To identify facial landmarks (geometry) within your User Content solely to enable
          specific editing features (e.g., skin smoothing, contour adjustments). We do not use this data for authentication
          or identity verification.{'\n'}
          - Product Improvement: To analyze Usage Data (on an aggregated and anonymized basis) to improve our algorithms,
          fix bugs, and develop new features.{'\n'}
          - Safety and Security: To detect, prevent, and address fraud, abuse, security risks, and technical issues.{'\n'}
          - Legal Compliance: To comply with applicable laws, regulations, and legal processes.
        </Text>

        <Text style={styles.heading}>4. How We Share Your Information</Text>
        <Text style={styles.paragraph}>We do not sell your personal data. We disclose your information only in the scenarios described below:</Text>
        <Text style={styles.subheading}>4.1 Service Providers</Text>
        <Text style={styles.paragraph}>
          We engage trusted third-party service providers to perform functions on our behalf. These providers are
          contractually obligated to protect your data and use it only for the purposes we disclose.
        </Text>
        <Text style={styles.paragraph}>Cloud Infrastructure: We use AWS (Singapore Region) and Google Cloud (Singapore Region) for secure data hosting and computation.</Text>
        <Text style={styles.paragraph}>
          AI Technology Partners: We utilize BytePlus Pte. Ltd. (and its affiliates) as our AI inference provider. We
          transmit necessary User Content to them strictly for image rendering. They are prohibited from retaining your
          data for their own independent model training.
        </Text>

        <Text style={styles.subheading}>4.2 Legal Obligations</Text>
        <Text style={styles.paragraph}>
          We may disclose your information to law enforcement, government authorities, or private parties if we believe
          in good faith that it is reasonably necessary to: (a) comply with a legal obligation, process, or request; (b)
          enforce our Terms of Service; (c) protect the safety, rights, or property of us, our users, or the public.
        </Text>

        <Text style={styles.subheading}>4.3 Business Transfers</Text>
        <Text style={styles.paragraph}>
          If we are involved in a merger, acquisition, bankruptcy, or sale of assets, your information may be transferred
          as part of that transaction.
        </Text>

        <Text style={styles.heading}>5. International Data Transfers</Text>
        <Text style={styles.paragraph}>Storage Location: Your personal data is primarily stored on servers located in Singapore.</Text>
        <Text style={styles.paragraph}>
          Cross-Border Transfer: By using the Services, you acknowledge and agree that your data may be transferred to,
          stored, and processed in Singapore and other countries where our third-party service providers operate (e.g., the
          United States). These countries may have data protection laws that are different from the laws of your country.
          We take appropriate safeguards, such as Standard Contractual Clauses (SCCs), to ensure your data remains
          protected during such transfers.
        </Text>

        <Text style={styles.heading}>6. Data Retention Policy</Text>
        <Text style={styles.paragraph}>We adhere to a strict retention schedule to protect your privacy:</Text>
        <Text style={styles.list}>
          - User Content (Images & Face Data): We implement an "Ephemeral Processing" policy. Original photos and generated
          results are automatically deleted from our cloud servers within 24 hours after the processing is complete. We do
          not retain this data for long-term storage.{'\n'}
          - Usage & Technical Data: We retain non-personal logs and analytics data for as long as necessary to improve the
          Services, resolve disputes, and comply with legal obligations.
        </Text>

        <Text style={styles.heading}>7. Data Security</Text>
        <Text style={styles.paragraph}>
          We employ administrative, technical, and physical security measures to protect your information from
          unauthorized access, loss, misuse, or alteration. These measures include encryption in transit (TLS/SSL) and
          encryption at rest. However, please note that no method of transmission over the Internet is 100% secure.
        </Text>

        <Text style={styles.heading}>8. Your Rights</Text>
        <Text style={styles.paragraph}>Depending on your jurisdiction, you may have the following rights regarding your personal data:</Text>
        <Text style={styles.list}>
          - Access: The right to know what data we hold about you.{'\n'}
          - Deletion: The right to request the deletion of your personal data.{'\n'}
          - Correction: The right to correct inaccurate data.{'\n'}
          - Withdrawal of Consent: The right to withdraw consent for processing where applicable.
        </Text>
        <Text style={styles.paragraph}>To exercise these rights, please contact us at support@miriai.app.</Text>

        <Text style={styles.heading}>9. Children's Privacy</Text>
        <Text style={styles.paragraph}>
          The Services are not directed to individuals under the age of 13 (or other age of majority in your
          jurisdiction). We do not knowingly collect personal data from children. If we become aware that we have
          collected such data, we will take steps to delete it.
        </Text>

        <Text style={styles.heading}>10. Updates to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will notify you of any material changes by updating the
          "Last Updated" date at the top of this Policy or by providing a notice within the App.
        </Text>

        <Text style={styles.heading}>11. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions about this Policy or our privacy practices, please contact our Data Protection Officer at:
        </Text>
        <Text style={styles.paragraph}>Email: support@miriai.app</Text>
        <Text style={styles.paragraph}>Mailing Address: Foshan Xinghang Trading Co., Ltd.</Text>
        <Text style={styles.paragraph}>
          Room 9E-1-B456, No. 121 Fenjiang Middle Road, Zumiao Subdistrict, Chancheng District, Foshan, Guangdong, China.
        </Text>

        <Text style={styles.heading}>ANNEX: Jurisdiction-Specific Supplemental Information</Text>
        <Text style={styles.paragraph}>
          This Annex applies if you reside in the following regions. In the event of a conflict between this Annex and
          the main body of the Policy, this Annex shall control.
        </Text>

        <Text style={styles.subheading}>A. European Economic Area (EEA) and United Kingdom (UK)</Text>
        <Text style={styles.paragraph}>Legal Basis for Processing: We process your personal data based on:</Text>
        <Text style={styles.list}>
          - Performance of Contract: To provide the image editing services you request.{'\n'}
          - Legitimate Interests: To improve the App, ensure security, and analyze usage trends.{'\n'}
          - Legal Obligation: To comply with applicable laws.
        </Text>
        <Text style={styles.paragraph}>
          International Transfers: When we transfer data outside the EEA/UK to Singapore or other countries, we rely on
          the European Commission's Standard Contractual Clauses (SCCs) to ensure adequate protection.
        </Text>

        <Text style={styles.subheading}>B. United States</Text>
        <Text style={styles.paragraph}>California Residents (CCPA/CPRA):</Text>
        <Text style={styles.list}>
          - We do not "sell" or "share" (for cross-context behavioral advertising) your personal information.{'\n'}
          - You have the right to request access to, correction of, and deletion of your personal information.{'\n'}
          - You have the right not to receive discriminatory treatment for exercising your privacy rights.
        </Text>
        <Text style={styles.paragraph}>Illinois Residents (BIPA) & Biometric Privacy:</Text>
        <Text style={styles.list}>
          - We collect "biometric identifiers" (face geometry) solely for the purpose of applying filters and effects.{'\n'}
          - Retention Schedule: All biometric data is permanently destroyed within 24 hours of the interaction. We do not
          store this data.{'\n'}
          - We do not disclose biometric data to third parties other than our critical AI vendors (BytePlus) necessary to
          provide the service, and solely for that purpose.
        </Text>

        <Text style={styles.subheading}>C. Brazil (LGPD)</Text>
        <Text style={styles.paragraph}>
          If you are located in Brazil, you have rights under the Lei Geral de Proteção de Dados (LGPD), including the
          right to confirm the existence of processing, access your data, correct incomplete, inaccurate, or out-of-date
          data, and revoke consent.
        </Text>

        <Text style={styles.subheading}>D. Singapore (PDPA)</Text>
        <Text style={styles.paragraph}>
          We comply with the obligations of the Personal Data Protection Act 2012 (PDPA). We have appointed a Data
          Protection Officer to oversee our compliance. We ensure that any overseas transfer of personal data is in
          accordance with the requirements prescribed under the PDPA to ensure that the recipient organization provides a
          standard of protection to personal data so transferred that is comparable to the protection under the PDPA.
        </Text>

        <Text style={styles.subheading}>E. South Korea</Text>
        <Text style={styles.paragraph}>Data Destruction: We destroy personal data immediately after the purpose of collection is achieved.</Text>
        <Text style={styles.paragraph}>Procedure: Electronic data is deleted permanently in a way that prevents recovery.</Text>
        <Text style={styles.paragraph}>
          Retention: If we are required to retain data by law (e.g., Protection of Communications Secrets Act), we will
          comply with such retention periods strictly.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  meta: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
  },
  heading: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.TEXT_PRIMARY,
    marginTop: 8,
  },
  subheading: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.TEXT_PRIMARY,
    marginTop: 4,
  },
  paragraph: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  list: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
});

export default PrivacyPolicyScreen;

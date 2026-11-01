import { Link } from 'react-router';

export default function VerificationStatus({ profile, showLink }) {
  const { verificationStatus: status, missing, rejectionReason } = profile;

  if (status === 'approved') {
    return (
      <p className="mt-6 rounded-xl border-2 border-leaf bg-white px-4 py-3">
        <strong>You are verified.</strong> Families near you can now find and choose you.
      </p>
    );
  }

  if (status === 'pending') {
    return (
      <p className="mt-6 rounded-xl border-2 border-marigold bg-white px-4 py-3">
        <strong>Under review.</strong> HOMEX is checking your documents. Families can see you once
        they are approved.
      </p>
    );
  }

  return (
    <div
      className={`mt-6 rounded-xl border-2 bg-white px-4 py-3 ${
        status === 'rejected' ? 'border-danger' : 'border-marigold'
      }`}
    >
      {status === 'rejected' ? (
        <>
          <p>
            <strong>Your profile needs changes.</strong> {rejectionReason}
          </p>
          <p className="mt-1 text-ink-soft">Fix this, then submit your profile again.</p>
        </>
      ) : (
        <p>
          <strong>Finish your profile.</strong> Families can only see you after HOMEX has verified
          you.
        </p>
      )}
      {missing.length > 0 && (
        <ul className="mt-2 list-disc pl-6 text-ink-soft">
          {missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {showLink && (
        <Link to="/caregiver/profile" className="text-link mt-2 inline-block">
          Go to your profile
        </Link>
      )}
    </div>
  );
}

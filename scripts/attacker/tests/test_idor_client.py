"""Offline regressions: never log into EC2 or contact a notification service."""

import argparse
import contextlib
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import idor_client as client
import exploit_idor
import exploit_idor_update
import exploit_idor_cancel

ORDER = "ef96b070-9fe3-4d81-a2b8-5cb98b83f337"


def response(status, body):
    result = Mock(status_code=status)
    result.json.return_value = body
    return result


def token(value="a"):
    return response(200, {"data": {"csrfToken": value * 64}})


class ClientTests(unittest.TestCase):
    def execute(self, replies, method="GET", suffix="", payload=None):
        session = Mock()
        session.__enter__ = Mock(return_value=session)
        session.__exit__ = Mock(return_value=False)
        session.request.side_effect = replies
        args = argparse.Namespace(url=client.DEFAULT_BASE_URL, id=ORDER, email="b@example.com")
        output = io.StringIO()
        with patch.object(client.requests, "Session", return_value=session), \
                patch.object(client.getpass, "getpass", return_value="private-test-value"), \
                contextlib.redirect_stdout(output):
            result = client.run(args, method, suffix, payload)
        return result, session, output.getvalue()

    def authenticated(self):
        return [token(), response(200, {"data": {"user": {"role": "CUSTOMER"}}}),
                response(200, {"data": []})]

    def test_defaults_and_explicit_order(self):
        parser = client.parser_for("test")
        self.assertEqual(parser.parse_args(["--id", ORDER]).url, "https://13.251.128.130")
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            parser.parse_args([])

    def test_origin_validation(self):
        self.assertEqual(client.origin("https://13.251.128.130/"), client.DEFAULT_BASE_URL)
        self.assertEqual(client.origin("http://127.0.0.1:3000"), "http://127.0.0.1:3000")
        for url in ["http://13.251.128.130", "https://user:pass@host", "https://host/api",
                    "https://host?token=x", "https://host#fragment", "https://host:wrong"]:
            with self.subTest(url=url), self.assertRaises(argparse.ArgumentTypeError):
                client.origin(url)
        with self.assertRaises(argparse.ArgumentTypeError):
            client.order_id("not-an-order-uuid")

    def test_read_denied_with_timeout_and_no_redirects(self):
        result, session, output = self.execute(
            self.authenticated() + [response(403, {"error": {"code": "FORBIDDEN"}})])
        self.assertEqual(result, 0)
        self.assertIn("[PASS]", output)
        self.assertEqual(session.request.call_args.args,
                         ("GET", client.DEFAULT_BASE_URL + "/api/orders/" + ORDER))
        for call in session.request.call_args_list:
            self.assertEqual(call.kwargs["timeout"], 10)
            self.assertFalse(call.kwargs["allow_redirects"])
            self.assertNotEqual(call.kwargs.get("verify"), False)
        self.assertNotIn("private-test-value", output)
        self.assertNotIn("a" * 64, output)

    def test_update_and_cancel_refresh_csrf(self):
        for method, suffix, payload in [("PATCH", "", {"shippingAddress": "test address"}),
                                        ("POST", "/cancel", {})]:
            with self.subTest(method=method):
                result, session, _ = self.execute(
                    self.authenticated() + [token("b"), response(403, {"error": {"code": "FORBIDDEN"}})],
                    method, suffix, payload)
                self.assertEqual(result, 0)
                self.assertEqual(session.request.call_args.args,
                                 (method, client.DEFAULT_BASE_URL + "/api/orders/" + ORDER + suffix))
                self.assertEqual(session.request.call_args.kwargs["headers"]["X-CSRF-Token"], "b" * 64)
                self.assertEqual(session.request.call_args.kwargs["json"], payload)

    def test_failed_login_never_registers_or_tests_order(self):
        for status in [401, 403, 429, 503]:
            with self.subTest(status=status):
                result, session, output = self.execute([token(), response(status, {"error": {}})])
                self.assertEqual(result, 2)
                self.assertEqual(session.request.call_count, 2)
                self.assertNotIn("[PASS]", output)
                self.assertTrue(all("/register" not in c.args[1] for c in session.request.call_args_list))

    def test_admin_is_not_an_idor_attacker(self):
        result, session, _ = self.execute([token(), response(200, {"data": {"user": {"role": "ADMIN"}}})])
        self.assertEqual(result, 2)
        self.assertEqual(session.request.call_count, 2)

    def test_own_order_is_not_an_idor_target(self):
        result, session, _ = self.execute(self.authenticated()[:2] + [response(200, {"data": [{"id": ORDER}]})])
        self.assertEqual(result, 2)
        self.assertEqual(session.request.call_count, 3)

    def test_csrf_403_is_inconclusive(self):
        result, _, output = self.execute(
            self.authenticated() + [response(403, {"error": {"code": "CSRF_INVALID"}})])
        self.assertEqual(result, 2)
        self.assertNotIn("[PASS]", output)

    def test_success_is_failure_without_dumping_order_pii(self):
        result, _, output = self.execute(self.authenticated() + [
            response(200, {"data": {"id": ORDER, "shippingAddress": "private address marker"}})])
        self.assertEqual(result, 1)
        self.assertIn("[FAIL]", output)
        self.assertNotIn("private address marker", output)

    def test_missing_order_invalid_state_and_outage_are_inconclusive(self):
        for status in [400, 401, 404, 429, 500, 503]:
            with self.subTest(status=status):
                result, _, output = self.execute(self.authenticated() + [response(status, {"error": {}})])
                self.assertEqual(result, 2)
                self.assertNotIn("[PASS]", output)

    def test_redirect_does_not_forward_login(self):
        result, session, _ = self.execute([response(308, {})])
        self.assertEqual(result, 2)
        self.assertEqual(session.request.call_count, 1)

    def test_malformed_json_and_csrf_stop_before_login(self):
        bad_json = response(200, {})
        bad_json.json.side_effect = ValueError("invalid JSON")
        for reply in [bad_json, response(200, []), response(200, {"data": {"csrfToken": "invalid"}})]:
            result, session, _ = self.execute([reply])
            self.assertEqual(result, 2)
            self.assertEqual(session.request.call_count, 1)

    def test_transport_error_is_sanitized(self):
        result, _, output = self.execute([client.requests.exceptions.SSLError("sensitive error detail")])
        self.assertEqual(result, 2)
        self.assertNotIn("sensitive error detail", output)

    def test_entrypoints_select_intended_operations(self):
        for module, method, suffix in [(exploit_idor, "GET", ""),
                                       (exploit_idor_update, "PATCH", ""),
                                       (exploit_idor_cancel, "POST", "/cancel")]:
            with self.subTest(module=module.__name__), \
                    patch.object(sys, "argv", [module.__name__, "--id", ORDER]), \
                    patch.object(module, "configure_console"), patch.object(module, "run", return_value=0) as run:
                self.assertEqual(module.main(), 0)
                self.assertEqual(run.call_args.args[0].url, client.DEFAULT_BASE_URL)
                actual_method = run.call_args.args[1] if len(run.call_args.args) > 1 else "GET"
                self.assertEqual(actual_method, method)
                self.assertEqual(run.call_args.kwargs.get("suffix", ""), suffix)


if __name__ == "__main__":
    unittest.main()
